import { LexerOutput } from "./Lexer.js";
import { TokenType, TokenTypeReadable } from "./Token.js";

export class LexerDebugOutput {
    constructor(public lexerOutput: LexerOutput){
        
    }

    toString(): string {
        let s: string = "<div class='jo_debugBold'>Tokens:</div>";
        for(let token of this.lexerOutput.tokens){
            switch(token.tt){
                case TokenType.identifier: s += `<span class="jo_debugIdentifier">${token.value}</span>`; break;
                case TokenType.integerConstant:
                case TokenType.floatingPointConstant:
                case TokenType.booleanConstant:
                case TokenType.stringConstant:
                case TokenType.charConstant:
                 s += `<span class="jo_debugConstant">${token.value}</span>`; break;
                case TokenType.space: s += " "; break;
                case TokenType.newline: s += "<br>"; break;
                default: s += `<span class="jo_debugDefaultToken">${TokenTypeReadable[token.tt]}</span>`; break;
            }
        }

        return s;
    }
}