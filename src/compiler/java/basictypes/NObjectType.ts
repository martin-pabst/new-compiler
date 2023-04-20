import { TokenType } from "../lexer/Token.js";
import { NMethodInfo, NParameterlist } from "./NAttributeMethod.js";
import { NClass } from "./NClass.js";
import { NPrimitiveTypeManager } from "./NPrimitiveTypeManager.js";
import { NType, NExpression } from "./NType.js";



export class NObjectType extends NClass {

    constructor(pt: NPrimitiveTypeManager){
        super("Object");

            let method: NMethodInfo = new NMethodInfo();
            method.identifier = "toString()";
            method.returnType = pt.String;
            method.invoke = (thread: any) => {
                    //@ts-ignore
                    return this.__class.identifier;
                }

            method.parameterlist = new NParameterlist([]);

            this.addMethod(method);
            this.setupRuntimeObjectPrototype();
        }


    getOperatorExpression(operator: TokenType, otherType?: NType): NExpression {
        return null;        
    }

    getOperatorResultType(operator: TokenType, otherType: NType): NType {
        return null;
    }

    compute(operator: TokenType, otherType: NType, value1: any, value2?: any) {
        return null;
    }

}
