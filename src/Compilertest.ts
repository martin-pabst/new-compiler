import jQuery from "jquery";
import { Rectangle } from "./DecoratedClass.js";
import { SYSTEMTYPES } from "./Decorators.js";

export class Compilertest {
    async start() {
        await this.loadMonacoEditor();

        monaco.editor.create(document.getElementById("topleft")!, {
            value: "Hello World!",
            language: "javascript",
            automaticLayout: true,
        });

        let fs = new Rectangle()
        console.log(SYSTEMTYPES);
        debugger;
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