import { NLibraryCompiler } from "../NLibraryCompiler.js";
import { NClassLike } from "../basictypes/NClass.js";
import { NThrowable, NException, NArithmeticException, NClassCastException } from "../basictypes/NExceptions.js";
import { NPrimitiveTypeManager } from "../basictypes/NPrimitiveTypeManager.js";
import { NType } from "../basictypes/NType.js";
import { NRuntimeObject } from "./NRuntimeObject.js";

export class NLibrary {

    /**
     * types and typeCache are set by libraryCompiler.compile
     */
    types: NType[];
    typeCache: Map<string, NClassLike>;

    constructor(private pt: NPrimitiveTypeManager){
        let libraryCompiler = new NLibraryCompiler(pt);
        libraryCompiler.compile(this);
    }

    getUncompiledTypes():NRuntimeObject[]{
        return [
            // Exceptions
            new NThrowable(), new NException(), new NArithmeticException(), new NClassCastException()
        ]
    }

}