import { NArrayType } from "./basictypes/NArray.js";
import { NAttributeInfo, NMethodInfo, NVariable } from "./basictypes/NAttributeMethod.js";
import { NClassLike, NClass, NInterface, NGenericParameter } from "./basictypes/NClass.js";
import { NEnum } from "./basictypes/NEnum.js";
import { NPrimitiveTypeManager } from "./basictypes/NPrimitiveTypeManager.js";
import { NType, NExpression } from "./basictypes/NType.js";
import { NVisibility, NVisibilityUtility } from "./basictypes/NVisibility.js";
import { Lexer } from "./lexer/Lexer.js";
import { Token, TokenList, TokenType, TokenTypeReadable } from "./lexer/Token.js";
import { NRuntimeObject } from "./runtime/NRuntimeObject.js";
import { NLibrary } from "./runtime/NStandardLibrary.js";


type NClassInfo = {
    class: NClassLike,
    declaration: Token[],
    runtimeObject: NRuntimeObject
}

export class NLibraryCompiler {

    tokenList: TokenList;
    pos: number;

    identifierToClassInfoMap: { [identifier: string]: NClassInfo };
    classLikes: NClassInfo[];

    /**
     * Cache all types without non-resolved generic parameters
     */
    globalTypeCache: Map<string, NClassLike>;

    constructor(private pt: NPrimitiveTypeManager) {

    }

    compile(library: NLibrary) {

        let systemClasses = library.getUncompiledTypes();
        this.globalTypeCache = new Map();
        library.typeCache = this.globalTypeCache;

        this.identifierToClassInfoMap = {};
        this.classLikes = [];

        // 1st pass: instantiate NClass, NInterface or NEnum for all classlikes, parse visibility modifiers,
        // abstract and identifiers of all unbound generic parameters (without extends... super...)
        for (let sc of systemClasses) {
            this.compileClassSignatureFirstPass(sc);
        }

        // 2nd pass: parse extend..., super... of all unbound generic parameters, parse extends... and implements of class/interface
        for (let ci of this.classLikes) {
            this.compileClassSignatureSecondPass(ci);
        }

        // 3rd pass: parse methods and attributes
        for (let classInfo of this.classLikes) {
            let classOrInterface = <NClass | NInterface | NEnum>classInfo.class;

            for (const [signature, program] of Object.entries(classInfo.runtimeObject.__getMethods())) {
                classOrInterface.addMethod(this.compileMethod(signature, program, classOrInterface));
            }

            for (let attributeSignature of classInfo.runtimeObject.__getAttributes()) {
                (<NClass|NEnum>classOrInterface).addAttribute(this.compileAttribute(attributeSignature, classOrInterface));

            }

            if (classOrInterface instanceof NClass) {
                classOrInterface.runtimeObjectPrototype = classInfo.runtimeObject;
                classOrInterface.setupRuntimeObjectPrototype();
                classOrInterface.computeFirstAttributeIndexAndInitialAttributeValues();
            }
        }

        library.types = this.classLikes.map((ci) => ci.class);

    }

    compileClassSignatureFirstPass(sc: NRuntimeObject) {

        let declaration = Lexer.quicklex(sc.__getSignature());
        this.setTokenList(declaration);
        let abstractAndVisibilityModifiers = this.compileAbstractAndVisibilityModifiers();
        let classInterfaceEnumKeyword = this.nextToken();
        let identifier = <string>(this.nextToken().value);
        let classLike: NClass | NInterface | NEnum = null;

        switch (classInterfaceEnumKeyword.tt) {
            case TokenType.keywordClass:
                classLike = new NClass(identifier);
                break;
            case TokenType.keywordInterface:
                classLike = new NInterface(identifier);
                break;
            case TokenType.keywordEnum:
                classLike = new NEnum(identifier);
                break;
        }

        if (classLike == null) return;

        classLike.visibility = abstractAndVisibilityModifiers.visibility;

        let ci: NClassInfo = {
            class: classLike,
            declaration: declaration,
            runtimeObject: sc
        }
        this.identifierToClassInfoMap[identifier] = ci;
        this.classLikes.push(ci);

        /**
         * Generic Parameters could be recursive, so we need to instantiate empty ones. 
         * Think of:
         * class A<T extends B<Integer>> 
         * class B<T extends A<Integer>>
         * 
         * In case of class A<S extends ArrayList<T>, T> we create "empty" generic parameters 
         * for S and T. We read "extends ArrayList<T> later in second pass."
         */
        let positionBeforeGenerics = this.pos;

        let bracketLevel: number = 0;

        if (this.comesToken(TokenType.lower) && (classLike instanceof NClass || classLike instanceof NInterface)) {
            bracketLevel = 1;
            this.nextToken();
            while (this.comesToken(TokenType.identifier) && bracketLevel == 1) {
                classLike.addGenericParameter(new NGenericParameter(<string>this.nextToken().value));
                while (!this.isEndOfTokenlist()) {
                    let tt = this.nextToken().tt;
                    if (tt == TokenType.lower) {
                        bracketLevel++;
                    } else if (tt == TokenType.greater) {
                        bracketLevel--;
                        if (bracketLevel == 0) break;
                    } else if (tt == TokenType.comma) {
                        break;
                    }
                }
            }
        }

        declaration = declaration.slice(positionBeforeGenerics);

    }

    private compileClassSignatureSecondPass(classInfo: NClassInfo) {

        this.setTokenList(classInfo.declaration);
        let classLike = classInfo.class;
        /**
         * First pass parsed tokens up to generic parameter definition and instantiated empty templates for them.
         * Now we revisit generic parameters and parse extends... and super... for them.
         */

        if (this.comesToken(TokenType.lower) && (classLike instanceof NClass || classLike instanceof NInterface)) {
            this.nextToken();
            let gpIndex: number = 0;
            while (this.comesToken(TokenType.identifier)) {
                let genericParameter = <NGenericParameter>classLike.genericParameters[gpIndex];
                this.compileUnboundGenericParameter(classLike, genericParameter);
                this.comesToken(TokenType.comma, true);
            }
            this.comesToken(TokenType.greater, true);
        }

        while (this.comesToken([TokenType.keywordExtends, TokenType.keywordImplements])) {
            if (this.nextToken().tt == TokenType.keywordExtends) {
                let type = this.compileClasslikeTypeFirstPass(classLike);
                if (type instanceof NClassLike) {
                    if (classLike instanceof NClass) {
                        classLike.extends = <NClass>type;
                    }
                    if (classLike instanceof NInterface) {
                        classLike.extendedInterfaces.push(<NInterface>type);
                    }
                } else {
                    console.log("LibraryCompiler.compileSystemClass: expecting class or interface, got: " + type.identifier + ".");
                }
            } else {
                if (classLike instanceof NInterface) {
                    console.log("LibraryCompiler.compileSystemClass: use keyword 'extends' to extend interface, not 'implements'.");
                } else {
                    while (this.comesToken(TokenType.identifier)) {
                        let type1 = this.compileClasslikeTypeFirstPass(classLike);
                        if (type1 instanceof NClassLike) {
                            if (classLike instanceof NClass || classLike instanceof NEnum) {
                                classLike.implements.push(<NInterface>type1);
                            }
                        } else {
                            console.log("LibraryCompiler.compileSystemClass: expecting interface, got: " + type1.identifier + ".");
                        }
                        this.comesToken(TokenType.comma, true);
                    }
                }
            }
        }
        return classLike;
    }



    setTokenList(tokenList: TokenList) {
        this.tokenList = tokenList.filter(t => {
            return [TokenType.space, TokenType.newline, TokenType.endofSourcecode].indexOf(t.tt) < 0
        });

        this.pos = 0;
    }

    nextToken(): Token {
        if (this.pos < this.tokenList.length) {
            let token = this.tokenList[this.pos];
            this.pos++;
            return token;
        }
        return null;
    }

    isEndOfTokenlist(): boolean {
        return this.pos == this.tokenList.length;
    }

    comesToken(tt: TokenType | TokenType[], skip: boolean = false): boolean {
        if (!Array.isArray(tt)) tt = [tt];
        if (this.pos < this.tokenList.length) {
            if (tt.indexOf(this.tokenList[this.pos].tt) >= 0) {
                if (skip) this.pos++;
                return true;
            }
        }
        return false;
    }

    expect(tt: TokenType | TokenType[], skip: boolean = false): boolean {
        if (!Array.isArray(tt)) tt = [tt];
        if (this.pos < this.tokenList.length) {
            if (tt.indexOf(this.tokenList[this.pos].tt) >= 0) {
                if (skip) this.pos++;
                return true;
            }
        }
        console.log("Expected one of: " + tt.map(t => { return TokenTypeReadable[t] }).join(", ") + "; found: " + this.foundTokenAsString());
        return false;
    }

    peekTokenType(): TokenType {
        if (this.pos < this.tokenList.length) {
            return this.tokenList[this.pos].tt;
        }

        return TokenType.endofSourcecode;
    }

    foundTokenAsString(): string {
        if (this.pos < this.tokenList.length) {
            return <string>this.tokenList[this.pos].value;
        }

        return "end of signature";
    }

    compileTypeFirstPass(classContext: NClassLike): NType {
        let type = this.compileClasslikeTypeFirstPass(classContext);
        let dimension = 0;
        while(this.comesToken(TokenType.leftRightSquareBracket, true)) dimension ++;    
        if(dimension > 0) type = new NArrayType(type, dimension);
        return type;
    }

    /**
     * Fetch next token and interpret it as type.
     * e.g. void, int, ArrayList<HashMap<Integer, String>>, ArrayList<N> (in context class MyTest<N>)
     */
    compileClasslikeTypeFirstPass(classContext: NClassLike): NType {

        if (this.isEndOfTokenlist()) {
            console.log("Warning: LibraryCompiler.compileTypeFirstPass -> tokenlength == 0; returning void...");
            return this.pt.void;
        }

        let firstToken = this.nextToken();

        if (firstToken.tt != TokenType.identifier) {
            console.log("Warning: LibraryCompiler.compileTypeFirstPass -> expecting identifier, got '" + firstToken.value + "'; returning void...");
            return this.pt.void;
        }

        // fetch token:
        let identifier = <string>firstToken.value;

        // is token a primitive type?
        let primitiveType = this.pt.getTypeFromIdentifier(identifier);
        if (primitiveType != null) {
            return primitiveType;
        }

        // is token a generic parameter (e.g. N in context of class Test<N>{...})?
        if (classContext != null && (classContext instanceof NClass || classContext instanceof NInterface)) {
            for (let genericParameter of classContext.genericParameters) {
                if (genericParameter.identifier == identifier) {
                    return genericParameter;
                }
            }
        }

        // is token a class or interface?
        let type = <NClass | NInterface | NEnum>this.identifierToClassInfoMap[identifier].class;

        if (type == null) {
            console.log("Error: LibraryCompiler.compileTypeFirstPass -> type " + identifier + " not found.");
            return this.pt.Object;
        }

        //is class/interface type followed by generic parameter values?
        //e.g. ArrayList<Integer>
        if (this.comesToken(TokenType.lower, true) && !(type instanceof NEnum)) {
            let genericParameterValues: NClassLike[] = [];
            while (this.comesToken(TokenType.identifier)) {

                genericParameterValues.push(<NClassLike>this.compileClasslikeTypeFirstPass(classContext));

                this.comesToken(TokenType.comma, true);
            }
            if (!this.comesToken(TokenType.greater)) {
                console.log("LibraryCompiler.compileTypeFirstPass -> expecting >");
            }

            let signature = identifier + "<" + genericParameterValues.map((gpv) => gpv.getSignature()).join(", ") + ">";

            /**
             * can we find type in cache?
             */
            let type1:NClassLike = null;
            if((type1 = this.globalTypeCache.get(signature)) != null){
                type = <any>type1;
            } else if(classContext != null && (type1 = classContext.typeCache.get(signature)) != null){
                type = <any>type1;
            } else {

                // type not found in cache => build it!
                let mapOldToNewGenericParameters: Map<NClassLike, NClassLike> = new Map();
                for (let i = 0; i < genericParameterValues.length; i++) {
                    mapOldToNewGenericParameters.set(type.genericParameters[i], genericParameterValues[i]);
                }
    
                // bind found generic parameter values to class/interface
                type = <NClass | NInterface | NEnum>type.buildShallowGenericCopy(mapOldToNewGenericParameters);
                
                if(type.containsUnresolvedGenericParameters() && classContext != null){
                    classContext.typeCache.set(signature, type);
                } else {
                    this.globalTypeCache.set(signature, type);
                }
            }

        }

        return type;

    }


    // TODO 24.04.2022: Static class...
    compileAttribute(attributeSignature: string, classOrInterface: NInterface | NClass | NEnum): NAttributeInfo {
        this.setTokenList(Lexer.quicklex(attributeSignature));
        let modifiers = this.compileAbstractAndVisibilityModifiers();
        let type = this.compileTypeFirstPass(classOrInterface);
        let identifier: string = "";
        if (!this.comesToken(TokenType.identifier)) {
            console.log("LibraryCompiler.compileMethod: Identifier expected in signature '" + attributeSignature + "', found: " + this.foundTokenAsString() + ".");
        } else {
            identifier = <string>this.nextToken().value;
        }
        let attribute = new NAttributeInfo(identifier, type, modifiers.static, modifiers.visibility, modifiers.isFinal);

        return attribute;

    }

    compileMethod(signature: string, functionOrNExpression: any, classOrInterface: NInterface | NClass | NEnum): NMethodInfo {
        this.setTokenList(Lexer.quicklex(signature));
        let abstractAndVisibilityModifiers = this.compileAbstractAndVisibilityModifiers();
        let type = this.compileTypeFirstPass(classOrInterface);
        let identifier: string = "";
        if (!this.comesToken(TokenType.identifier)) {
            console.log("LibraryCompiler.compileMethod: Identifier expected in signature '" + signature + "', found: " + this.foundTokenAsString() + ".");
        } else {
            identifier = <string>this.nextToken().value;
        }

        let method: NMethodInfo = new NMethodInfo();
        method.identifier = identifier;
        method.returnType = type;
        method.isAbstract = abstractAndVisibilityModifiers.abstract;
        method.visibility = abstractAndVisibilityModifiers.visibility;
        method.isStatic = abstractAndVisibilityModifiers.static;

        this.expect(TokenType.leftBracket, true);

        let numberOfParameters: number = 0;
        while (this.comesToken(TokenType.identifier)) {

            let type = this.compileTypeFirstPass(classOrInterface);
            let parameterIdentifier = "";
            if (this.expect(TokenType.identifier)) {
                parameterIdentifier = <string>this.nextToken().value;
            }
            let parameter = new NVariable(identifier, type);
            numberOfParameters++;
            parameter.stackPos = numberOfParameters; // stackpos 0 is for this-object!
            method.parameterlist.parameters.push(parameter);
            this.comesToken(TokenType.comma, true)
        }

        this.expect(TokenType.rightBracket, true);

        if (typeof functionOrNExpression == "object") {
            let nx = <NExpression>functionOrNExpression;
            method.expression = nx.e;
        } else {
            let f = <() => void>functionOrNExpression;
        }

        method.setupSignature();

        return method;
    }

    private compileAbstractAndVisibilityModifiers(): { abstract: boolean, visibility: NVisibility, static: boolean, isFinal: boolean } {
        let visibility: NVisibility = NVisibility.public;
        let isAbstract = false;
        let isStatic = false;
        let isFinal = false;

        let notDone: boolean = true;
        while (notDone) {
            let tt = this.peekTokenType();
            switch (tt) {
                case TokenType.keywordPublic:
                case TokenType.keywordPrivate:
                case TokenType.keywordProtected:
                    visibility = NVisibilityUtility.tokenTypeToVisibility(tt);
                    this.nextToken();
                    break;
                case TokenType.keywordAbstract:
                    isAbstract = true;
                    this.nextToken();
                    break;
                case TokenType.keywordStatic:
                    isStatic = true;
                    this.nextToken();
                    break;
                case TokenType.keywordFinal:
                    isFinal = true;
                    this.nextToken();
                    break;
                default:
                    notDone = false;
                    break;
            }
        }

        return { abstract: isAbstract, visibility: visibility, static: isStatic, isFinal: isFinal }
    }

    compileUnboundGenericParameter(classContext: NClassLike, genericParameter: NGenericParameter) {

        let identifier = <string>this.nextToken().value;
        genericParameter.identifier = identifier;

        while (this.comesToken([TokenType.keywordExtends, TokenType.keywordSuper], false)) {

            switch (this.nextToken().tt) {
                case TokenType.keywordExtends:
                    while (this.comesToken(TokenType.identifier)) {
                        let type = this.compileClasslikeTypeFirstPass(classContext);
                        if (type instanceof NClassLike) {
                            genericParameter.extends.push(type);
                        } else {
                            console.log("LibraryCompiler.compileUnboundGenericParameter: expecting class or interface, got " + type.identifier + ".");
                        }
                        this.comesToken(TokenType.ampersand, true);
                    }
                    break;
                case TokenType.keywordSuper:
                    let type = this.compileClasslikeTypeFirstPass(classContext);
                    if (type instanceof NClassLike) {
                        genericParameter.super = <NClass>type;
                    } else {
                        console.log("LibraryCompiler.compileUnboundGenericParameter: expecting class or interface, got " + type.identifier + ".");
                    }

            }

        }

        this.comesToken(TokenType.greater, true);

        return genericParameter;
    }



}