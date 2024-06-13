import { readFileSync } from "node:fs"
import { Flow, type FlowStep } from "./flow.js"
import tokenizr from "tokenizr"

const Tokenizr = tokenizr as unknown as typeof tokenizr.default
type Token = tokenizr.Token

export function parseFlowFile(filepath: string): Flow {
    const input = readFileSync(filepath, "utf-8")
    const steps: FlowStep[] = []
    const errors: FlowFileError[] = []

    try {
        const statements = tokenize(input)
            .reduce((acc, token) => {
                if (token.type === "eol") acc.push([])
                else if (token.type === "EOF") return acc
                else acc[acc.length - 1].push(token)
                return acc
            }, [[]] as Token[][])
            .filter(statement => statement.length)

        for (let [command, ...args] of statements) {
            try {
                if (command.type !== "command" || !(command.value in commands))
                    throw new SemanticError(command, `invalid command '${command.value}'`)

                const argsCount = commands[command.value].length
                if (args.length !== argsCount)
                    throw new SemanticError(command,
                        `expected ${argsCount} arguments to command '${command.value}', got ${args.length}`)

                // parse command
                const step = commands[command.value](...args)
                steps.push(step)

            } catch (error) {
                if (error instanceof SemanticError)
                    errors.push(new FlowFileError(filepath, error.token.line, error.token.column, error.message))
                else throw error
            }
        }
    } catch (error) {
        if (error instanceof Tokenizr.ParsingError)
            errors.push(new FlowFileError(filepath, error.line, error.column, error.message))
        else throw error
    }

    if (errors.length > 0)
        throw new FlowParserError(errors)

    return new Flow(steps)
}

function tokenize(input: string) {
    const lexer = new Tokenizr()

    /**
     * Start with
     * (?<=^\s*)    if first token of the line
     * (?<!^\s*)    if not first token of the line
     */

    // end of line
    lexer.rule(/\n/, ctx => ctx.accept("eol", undefined))

    // command keyword
    lexer.rule(/(?<=^\s*)\w+/im, (ctx, match) => ctx.accept("command", match[0].toLowerCase()))

    // quoted args
    lexer.rule(/(?<!^\s*)"((?:\\"|[^"])*)"/m, (ctx, match) => ctx.accept("arg", match[1].replaceAll("\\\"", "\"")))

    // ignore comments
    lexer.rule(/%[^\n]+/, ctx => ctx.ignore())

    // ignore whitespaces
    lexer.rule(/[ \t\r]+/, ctx => ctx.ignore())

    // unquoted args
    lexer.rule(/(?<!^\s*)[^"][^\s%]*/m, ctx => ctx.accept("arg"))

    lexer.input(input)
    return lexer.tokens()
}

const commands: Record<string, (...args: Token[]) => FlowStep> = {
    click(selector: Token) {
        return { type: "click", params: [selector.value] }
    },

    select(value: Token, keyword: Token, selector: Token) {
        if (keyword.value !== "in" && keyword.value !== "of")
            throw new SemanticError(keyword, `expected 'of' or 'in', got '${keyword.value}'`)
        return { type: "select", params: [selector.value, value.value] }
    },

    type(value: Token, keyword: Token, selector: Token) {
        if (keyword.value !== "into" && keyword.value !== "in")
            throw new SemanticError(keyword, `expected 'into' or 'in', got '${keyword.value}'`)
        return { type: "type", params: [selector.value, value.value] }
    },

    scroll(keyword: Token, selector: Token) {
        if (keyword.value !== "to")
            throw new SemanticError(keyword, `expected 'to', got '${keyword.value}'`)
        return { type: "scroll", params: [selector.value] }
    },

    begin(name: Token) {
        return { type: "begin", params: [name.value] }
    },

    end(keyword: Token, selector: Token) {
        if (keyword.value !== "when")
            throw new SemanticError(keyword, `expected 'when', got '${keyword.value}'`)
        return { type: "end", params: [selector.value] }
    },
}

export class FlowParserError extends Error {
    public errors: FlowFileError[]

    public constructor(errors: FlowFileError[]) {
        super(`Couldn't parse flow file (${errors.length} error(s) encountered)`)
        this.errors = errors
    }
}

export class FlowFileError extends Error {
    public file: string
    public line: number
    public col: number

    public constructor(file: string, line: number, col: number, message: string) {
        super(message)
        this.file = file
        this.line = line
        this.col = col
    }
}

class SemanticError extends Error {
    public token: Token

    public constructor(token: Token, message: string) {
        super(message)
        this.token = token
    }
}
