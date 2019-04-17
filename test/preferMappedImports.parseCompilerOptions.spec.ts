import { parseCompilerOptions, RemapOptions } from "../src/preferMappedImportsRule";

describe("prefer-mapped-imports parseCompilerOptions", () => {
    it(`parse mobile options`, () => {
        const result = parseCompilerOptions({
            baseUrl: ".",
            paths: {
                "@src/*": ["src/*.tns.ts", "src/*.android.ts", "src/*.ios.ts", "src/*"]
            }
        });

        const expected: RemapOptions = {
            baseUrl: "./",
            prefix: "@src/",
            prefixMappedTo: "src/"
        };
        expect(result).toEqual(expected);
    });

    it(`parse web options`, () => {
        const result = parseCompilerOptions({
            baseUrl: ".",
            paths: {
                "@src/*": ["src/*.web.ts", "src/*"]
            }
        });

        const expected: RemapOptions = {
            baseUrl: "./",
            prefix: "@src/",
            prefixMappedTo: "src/"
        };
        expect(result).toEqual(expected);
    });
});
