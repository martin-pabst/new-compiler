import jQuery from "jquery";
import { Rectangle } from "./DecoratedClass.js";
import { SYSTEMTYPES } from "./Decorators.js";
import { defineMyJava } from "./compiler/java/editor/MyJava.js";
import { Lexer } from "./compiler/java/lexer/Lexer.js";
import { LexerDebugOutput } from "./compiler/java/lexer/LexerDebugOutput.js";

export class Compilertest {

    editor?: monaco.editor.IStandaloneCodeEditor;

    async start() {
        await this.loadMonacoEditor();
        
        defineMyJava();

        this.editor = monaco.editor.create(document.getElementById("topleft")!, {
            value: "Hello World!",
            language: "myJava",
            automaticLayout: true,
        });
        this.makeButton();

        this.testTypeAnnotations();
    }


    makeButton(){
        let $button = jQuery('<button id="compileButton">Compile</button>');
        jQuery('body').append($button);
        $button.on('click', () => {
            let text = this.editor?.getModel()?.getValue();

            let lexer: Lexer = new Lexer();
            let lexerOutput = lexer.lex(text);
            let html = new LexerDebugOutput(lexerOutput).toString();
            jQuery('#topright').html(html);

        })
    }

    testTypeAnnotations(){
        let fs = new Rectangle()
        console.log(SYSTEMTYPES);

    }

    loadMonacoEditor(): Promise<void> {
        //@ts-ignore
        window.require.config({ paths: { 'vs': 'lib/monaco-editor/dev/vs' } });
        //@ts-ignore
        window.require.config({
            'vs/nls': {
                availableLanguages: {
                    '*': 'de'
                }
            },
            ignoreDuplicateModules: ["vs/editor/editor.main"]
        });

        return new Promise((resolve, _reject) => {
            //@ts-ignore
            window.require(['vs/editor/editor.main'], () => {
                resolve();
            })
        });
    }

}


jQuery(() => { new Compilertest().start() });