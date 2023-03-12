type AttributeInfo = {
    identifier: string,
    type: string,
    index: number
}

type StaticAttributeInfo = {
    identifier: string,
    type: string
}

type ParameterInfo = {
    identifier: string,
    type: string
}

type MethodInfo = {
    identifier: string,
    returnType: string | null,
    parameters: ParameterInfo[],
    isConstructor: boolean
}

type ClassInfo = {
    identifier: string,
    extends?: any,      // Prototype of extended class
    implements: string[],
    isAbstract: boolean,
    isEnum: boolean
}

/**
 * fields per prototype
 */
export const AttInfoList = "__attributeInfoList__";
export const AttDefaultValueList = "__attributeDefaultValueList__";
export const ClassInfo = "__classInfo__";
export const StaticAttributeInfoList = "__staticAttributeInfoList__";
export const MethodInfoList = "__methodInfoList__";

const Implements = "__implements__";

/**
 * fields per object
 */
export const AttArray = "__att__";

export var SYSTEMTYPES: any[] = [];


export function _enum(identifier: string | null = null){

    return (constructor: Function) => {
        _classOrEnum(identifier, false, true)(constructor);
        //@ts-ignore
        constructor.__init__();
    }


}

export function _class(identifier: string | null = null, isAbstract: boolean = false) {
    return _classOrEnum(identifier, isAbstract);
}


function _classOrEnum(identifier: string | null = null, isAbstract: boolean = false, isEnum: boolean = false) {

    return (constructor: Function) => {
        let id = identifier ? identifier : constructor.name;
        let myPrototype = constructor.prototype;

        SYSTEMTYPES.push(myPrototype);
    
        let baseClassPrototype = Object.getPrototypeOf(myPrototype);
    
        myPrototype[ClassInfo] = {
            identifier: id,
            extends: baseClassPrototype[ClassInfo]?baseClassPrototype : null,
            implements: myPrototype[Implements]?myPrototype[Implements] : [],
            isAbstract: isAbstract, 
            isEnum: isEnum
        };

        myPrototype[Implements] = undefined;

        if(!myPrototype.hasOwnProperty(AttInfoList)){
            let baili = baseClassPrototype[AttInfoList]
            if(baili != null){
                myPrototype[AttInfoList] = baili.slice();
                myPrototype[AttDefaultValueList] = baseClassPrototype[AttDefaultValueList].slice();
                myPrototype[MethodInfoList] = baseClassPrototype[MethodInfoList].slice();
            } else {
                myPrototype[AttInfoList] = [];
                myPrototype[AttDefaultValueList] = [];
                myPrototype[MethodInfoList] = [];
            }

        } 

        // for all constructors: set identifier = class identifier
        let methodInfoList: MethodInfo[] = myPrototype[MethodInfoList];
        for(let mi of methodInfoList){
            if(mi.returnType == null) mi.identifier = id
        }

    }

}

export function _implements(...identifiers: string[]) {

    return (constructor: Function) => {
        let myPrototype = constructor.prototype;
    
        myPrototype[Implements] = identifiers;

    }

}


let DefaultValues: {[key: string]: any} = {
    "int": 0,
    "boolean": false,
    "double": 0.0,
    "float": 0.0
}

export function _attribute(type: string, defaultValue?: any){
    return (target: Object, id: string) => {
        // console.log("Attribute " +  id + " is declared and has type " + type);
        
        let attributeInfoList:AttributeInfo[]
        let attributeDefaultValueList: any[];

        let myPrototype = target.constructor.prototype;

        if(myPrototype.hasOwnProperty(AttInfoList)){
            attributeInfoList = myPrototype[AttInfoList];
            attributeDefaultValueList = myPrototype[AttDefaultValueList];
        } else {
            let baseClass = Object.getPrototypeOf(target);
            let baili = baseClass[AttInfoList]
            if(baili != null){
                attributeInfoList = baili.slice();
                attributeDefaultValueList = baseClass[AttDefaultValueList].slice();
            } else {
                attributeInfoList = [];
                attributeDefaultValueList = [];
            }
            myPrototype[AttInfoList] = attributeInfoList;
            myPrototype[AttDefaultValueList] = attributeDefaultValueList;
        }

        let index = attributeInfoList.length;

        if(defaultValue == null){
            defaultValue = DefaultValues[type];
            if(defaultValue == null) defaultValue = null;
        }
        attributeDefaultValueList.push(defaultValue);

        attributeInfoList.push({
            identifier: id,
            type: type,
            index: index
        })

        Object.defineProperty(target, id, {
            get: function(){
                return this[AttArray][index];
            },
            set: function(value){
                this[AttArray][index] = value;
            }
        })

    }
}

export function _staticAttribute(type: string){
    return (target: Function, id: string) => {
        // console.log("Static attribute " +  id + " is declared and has type " + type);
        
        let staticAttributeInfoList:StaticAttributeInfo[]

        let myPrototype = target.prototype;

        if(myPrototype.hasOwnProperty(StaticAttributeInfoList)){
            staticAttributeInfoList = myPrototype[StaticAttributeInfoList];
        } else {
            staticAttributeInfoList = [];
            myPrototype[StaticAttributeInfoList] = staticAttributeInfoList;
        }

        staticAttributeInfoList.push({
            identifier: id,
            type: type
        })

    }
}

export function _constructor(...parameters: string[]){
    return _method(null, null, ...parameters);
}

export function _method(name: string | null, returnType: string | null, ...parameters: string[]){
    return (target: Object, _memberName: string, _propertyDescriptor: PropertyDescriptor) => {
        let methodInfoList:MethodInfo[]

        if(name == null){
            if(returnType == null){
                name = "__constructor__"; // gets replaced when class decorator executes
            } else {
                name = _memberName;
            }
        }

        let myPrototype = target.constructor.prototype;

        if(myPrototype.hasOwnProperty(MethodInfoList)){
            methodInfoList = myPrototype[MethodInfoList];
        } else {
            let baseClass = Object.getPrototypeOf(target);
            let baili = baseClass[MethodInfoList]
            if(baili != null){
                methodInfoList = baili.slice();
            } else {
                methodInfoList = [];
            }
            myPrototype[MethodInfoList] = methodInfoList;
        }

        let methodInfo: MethodInfo = {
            identifier: name,
            returnType: returnType,
            parameters: [],
            isConstructor: returnType == null
        };

        methodInfoList.push(methodInfo)

        for(let parameter of parameters){
            let i = parameter.lastIndexOf(" ");
            let type = parameter.substring(0, i);
            let identifier = parameter.substring(i+1);
            methodInfo.parameters.push({
                identifier: identifier, 
                type: type
            })
        }

        // console.log("Method: " + memberName);

    }
}

