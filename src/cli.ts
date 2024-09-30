import { InvalidArgumentError } from "commander"

interface parseStringOptions {
    minLength: number
    maxLength: number
}

interface ParseNumberOptions {
    min: number | { value: number, excluded: boolean }
    max: number | { value: number, excluded: boolean }
    type: "int" | "float"
}

export function parseString({ minLength, maxLength }: Partial<parseStringOptions> = {}):
    (value: string) => string {

    return arg => {
        if (minLength && arg.length < minLength)
            throw new InvalidArgumentError(`String must be at least ${minLength} characters long.`)
        if (maxLength && arg.length > maxLength)
            throw new InvalidArgumentError(`String must be at max ${maxLength} characters long.`)
        return arg
    }
}

export function parseNumber({ min = -Infinity, max = Infinity, type }: Partial<ParseNumberOptions> = {}):
    (value: string) => number {

    return arg => {
        let value
        if (type === "int") {
            value = parseInt(arg)
            if (Number.isNaN(value))
                throw new InvalidArgumentError("Argument must be an integer.")
        } else if (type === "float") {
            value = parseFloat(arg)
            if (Number.isNaN(value))
                throw new InvalidArgumentError("Argument must be an floating-point number.")
        } else {
            value = Number(arg)
            if (Number.isNaN(value))
                throw new InvalidArgumentError("Argument must be a number.")
        }

        if (typeof min === "number") min = { value: min, excluded: false }
        if (typeof max === "number") max = { value: max, excluded: false }

        if ((min.excluded ? value <= min.value : value < min.value) ||
            (max.excluded ? value >= max.value : value > max.value)) {
            if (min.value === -Infinity && min.excluded)
                throw new InvalidArgumentError(`Value must be smaller than ${max.value}.`)
            if (min.value === -Infinity && !min.excluded)
                throw new InvalidArgumentError(`Value cannot be larger than ${max.value}.`)
            if (max.value === Infinity && max.excluded)
                throw new InvalidArgumentError(`Value must be larger than ${min.value}.`)
            if (max.value === Infinity && !max.excluded)
                throw new InvalidArgumentError(`Value cannot be smaller than ${min.value}.`)
            throw new InvalidArgumentError(`Argument must be a value between ${min.value} and ${max.value}.`)
        }
        return value
    }
}

export function parseNumList(options: Partial<ParseNumberOptions> = {}):
    (value: string, list: number[]) => number[] {

    const parse = parseNumber(options)
    return (value, list) => list ? list.concat(parse(value)) : [parse(value)]
}

export function parseBox2d(options: Partial<ParseNumberOptions> = {}):
    (value: string) => { width: number, height: number } {

    const parse = parseNumber(options)
    return value => {
        if (!/^-?\d+,-?\d+$/.test(value))
            throw new InvalidArgumentError("Argument must match the following form: \"<integer>,<integer>\".")

        const values = value.split(",").map(parse)
        return {
            width: values[0],
            height: values[1],
        }
    }
}
