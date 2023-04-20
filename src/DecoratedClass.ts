import { AttDefaultValueList, _attribute as _attribute, _implements, _class as classDef, _method, _staticAttribute, _constructor, _class, _enum, AttributeInfo, ClassInfo, StaticAttributeInfo, MethodInfo } from "./Decorators.js";

// export const AttInfoList = "__attributeInfoList__";
// export const AttDefaultValueList = "__attributeDefaultValueList__";
// export const ClassInfo = "__classInfo__";
// export const StaticAttributeInfoList = "__staticAttributeInfoList__";
// export const MethodInfoList = "__methodInfoList__";

export type PrimitiveJavascriptType = string | number | boolean | null;

@classDef("Object")
export class ObjectClass {
    __att__: any[] = ((<any>this)[AttDefaultValueList]).slice();
    declare __attributeInfoList__: AttributeInfo[];
    declare __methodInfoList__: MethodInfo[];
    declare __attributeDefaultValueList__: PrimitiveJavascriptType[];
    declare __classInfo__: ClassInfo;
    declare __staticAttributeInfoList__: StaticAttributeInfo[];
}


export class BaseEnum extends ObjectClass {
    
    constructor(protected __identifier: string, protected __ordinal: number){
        super();
    }

    @_method("toOrdinal", "int")
    toOrdinal():number {
        return this.__ordinal;
    }

}

@classDef()
export class Shape extends ObjectClass {

    @_attribute("double", 10)
    declare angle: number;

    rotate(angle: number): void {
        console.log("Test!");
    }

}

@classDef()@_implements("Serializable")
export class FilledShape extends Shape {
    @_attribute("int")
    declare color: number;

    @_staticAttribute("double")
    static PI: number = 3.14;

    setFillcolor(color: number): void {
        console.log("Test!");
    }
}

@classDef()
export class Rectangle extends FilledShape {

    constructor(){
        super();
    }

    @_attribute("double")
    declare width: number;


    // Java constructor is called immediately after typescript constructor above
    @_constructor("double left", "double top", "double width", "double height")
    constructor1(left: number, top: number, width: number, height: number): Rectangle {
        return this;
    }

    @_method("void", "double width")
    setWidth(width: number): void {
        console.log("Test!");
    }
}

@_class("Vector2")
export class Vector2 extends ObjectClass {

    @_attribute("double", 0)
    declare public x: number;

    @_attribute("double", 0)
    declare public y: number;

    @_constructor("double x", "double y")
    constructor1(x: number, y: number): Vector2 {
        this.x = x;
        this.y = y;
        return this;
    }

}

@_enum()
export class Direction extends BaseEnum {

    static __nextOrdinal: number = 0;

    static __values__: Direction[];

    @_attribute("Vector2")
    declare vector: Vector2;

    constructor(identifier: string, dx: number, dy: number){
        super(identifier, Direction.__nextOrdinal++);
        this.vector = new Vector2().constructor1(dx, dy);
    }

    static __init__(){
        Direction.__values__ =
        [
            new Direction("top", 0, -1),
            new Direction("right", 1, 0),
            new Direction("bottom", 0, 1),
            new Direction("left", -1, 0)
        ]
    }

    @_method(null, "Direction")
    getNextClockwise(): Direction {
        return Direction.__values__[(this.__ordinal + 1)%4];
    }



}


