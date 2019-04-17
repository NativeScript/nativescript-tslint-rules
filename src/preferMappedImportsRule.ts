import * as ts from "typescript";
import * as Lint from "tslint";
import * as tsutils from "tsutils";
import { join as joinPath, dirname as getDirname } from "path";

interface WalkerOptions {
    platformRemapFn?: (name: string) => string;
}
const OPTION_PREFIX = "prefix";
const OPTION_PREFIX_MAPPED = "prefix-mapped-to";
const OPTION_BASE_URL = "base-url";

export interface RemapOptions {
    baseUrl: string;
    prefix: string;
    prefixMappedTo: string;
}

export interface RuleArgs {
    [OPTION_BASE_URL]: string;
    [OPTION_PREFIX]: string;
    [OPTION_PREFIX_MAPPED]: string;
}

// TODO: Add documentation for the recommended remapped paths and link it in the error message.
const FAILURE_BODY_RELATIVE = "module is being loaded from a relative path. Please use a remapped path.";
const FAILURE_BODY_INSIDE = "module path should not contain reference to current or parent directory inside";

// Looks for path separator `/` or `\\`(Windows style)
// followed than one or two dot characters
// followed by path separator (same as initial).
const illegalInsideRegex = /(\/|\\)\.\.?\1/;

export class Rule extends Lint.Rules.OptionallyTypedRule {
    static readonly metadata: Lint.IRuleMetadata = {
        ruleName: "prefer-mapped-imports",
        type: "maintainability",
        description: "Prefer using mapped paths when importing external modules or ES6 import declarations.",
        options: {
            type: "object",
            properties: {
                [OPTION_PREFIX]: { type: "string" },
                [OPTION_PREFIX_MAPPED]: { type: "string" },
                [OPTION_BASE_URL]: { type: "string" }
            }
        },
        // TODO: Add documentation for the recommended remapped paths and link it in the rationale.
        optionsDescription: `${OPTION_PREFIX}\` specifies the prefix for the mapped imports.`,
        typescriptOnly: false,
        rationale: "..."
    };

    apply(sourceFile: ts.SourceFile) {
        const remapOptions = this.parseRuleOptions(this.ruleArguments);
        const walkerOptions = {
            platformRemapFn: remapOptions ? createRemapFn(sourceFile, remapOptions) : undefined
        };

        return this.applyWithFunction(sourceFile, walk, walkerOptions);
    }

    applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Array<Lint.RuleFailure> {
        const compilerOptions = program.getCompilerOptions();
        if (!compilerOptions) {
            throw new Error(`Base URL and path mappings must be specified as TS compiler options!`);
        }
        const remapOptions = this.parseCompilerOptions(compilerOptions);
        const walkerOptions = {
            platformRemapFn: createRemapFn(sourceFile, remapOptions)
        };

        return this.applyWithFunction(sourceFile, walk, walkerOptions);
    }

    private parseRuleOptions(ruleArgs: Array<RuleArgs>): RemapOptions | undefined {
        if (
            !(
                ruleArgs &&
                ruleArgs[0] &&
                ruleArgs[0][OPTION_PREFIX] &&
                ruleArgs[0][OPTION_PREFIX_MAPPED] &&
                ruleArgs[0][OPTION_BASE_URL]
            )
        ) {
            return undefined;
        }

        return {
            prefix: ruleArgs[0][OPTION_PREFIX],
            prefixMappedTo: ruleArgs[0][OPTION_PREFIX_MAPPED],
            baseUrl: ruleArgs[0][OPTION_BASE_URL]
        };
    }

    private parseCompilerOptions(compilerOptions: ts.CompilerOptions): RemapOptions {
        let baseUrl = compilerOptions.baseUrl;
        if (!baseUrl) {
            throw new Error(`Base url is not specified!`);
        }

        if (!baseUrl.endsWith("/")) {
            baseUrl = baseUrl + "/";
        }

        const paths = compilerOptions.paths;
        if (!paths) {
            throw new Error(`Path mappings are not specified!`);
        }

        const entries = Object.entries(paths);

        const isMobileMapping = (path: string) => ["tns", "android", "ios"].some((platform) => path.includes(platform));
        const isWebMapping = (path: string) => path.includes("web");

        const platformEntry = entries.find((entry) => {
            // entry[0] -> @src/*
            // entry[1] -> [src/*.web, src/*]
            const platforms = entry[1];

            return platforms.some((platform) => isMobileMapping(platform) || isWebMapping(platform));
        });

        if (!platformEntry) {
            throw new Error(`Platform mapping is not found in the configured TS paths!`);
        }

        const prefix = platformEntry[0].substr(0, platformEntry[0].indexOf("*"));
        const prefixMappedTo = platformEntry[1][0].substr(0, platformEntry[1][0].indexOf("*"));

        return {
            baseUrl,
            prefix,
            prefixMappedTo
        };
    }
}

function walk(ctx: Lint.WalkContext<WalkerOptions>) {
    const { platformRemapFn } = ctx.options;

    function getValidationErrorBody(expression: ts.Expression): string | undefined {
        if (tsutils.isStringLiteral(expression)) {
            const path = expression.text;

            // when no siblings allowed path cannot start with '.' (relative)
            if (path[0] === ".") {
                return FAILURE_BODY_RELATIVE;
            }

            // '/../' and '/./' are always disallowed in the middle of module path
            if (illegalInsideRegex.test(path)) {
                return FAILURE_BODY_INSIDE;
            }
        }

        // explicitly return undefined when path is valid or not a literal
        return undefined;
    }

    function cb(node: ts.Node): void {
        if (tsutils.isExternalModuleReference(node)) {
            const errorBody = getValidationErrorBody(node.expression);
            if (errorBody !== undefined) {
                if (!platformRemapFn) {
                    ctx.addFailureAt(node.getStart(), node.getWidth(), `External ${errorBody}: ${node.getText()}`);
                } else {
                    // TODO: Create fix
                }
            }
        } else if (tsutils.isImportDeclaration(node)) {
            const errorBody = getValidationErrorBody(node.moduleSpecifier);

            if (errorBody !== undefined) {
                if (!platformRemapFn) {
                    ctx.addFailureAt(node.getStart(), node.getWidth(), `Imported ${errorBody}: ${node.getText()}`);
                } else {
                    // Create a fix
                    const moduleSpecifier = node.moduleSpecifier;
                    const importText = moduleSpecifier.getText().substr(1, moduleSpecifier.getText().length - 2);
                    const remappedImport = `'${platformRemapFn(importText)}'`;

                    const fix = new Lint.Replacement(
                        moduleSpecifier.getStart(),
                        moduleSpecifier.getWidth(),
                        remappedImport
                    );

                    ctx.addFailureAt(node.getStart(), node.getWidth(), `Imported ${errorBody}: ${node.getText()}`, fix);
                }
            }
        }

        return ts.forEachChild(node, cb);
    }

    return ts.forEachChild(ctx.sourceFile, cb);
}

export function parseCompilerOptions(compilerOptions: ts.CompilerOptions): RemapOptions {
    let baseUrl = compilerOptions.baseUrl;
    if (!baseUrl) {
        throw new Error(`Base url is not specified!`);
    }

    if (!baseUrl.endsWith("/")) {
        baseUrl = baseUrl + "/";
    }

    const paths = compilerOptions.paths;
    if (!paths) {
        throw new Error(`Path mappings are not specified!`);
    }

    const entries = Object.entries(paths);

    const isMobileMapping = (path: string) => ["tns", "android", "ios"].some((platform) => path.includes(platform));
    const isWebMapping = (path: string) => path.includes("web");

    const platformEntry = entries.find((entry) => {
        // entry[0] -> @src/*
        // entry[1] -> [src/*.web, src/*]
        const platforms = entry[1];

        return platforms.some((platform) => isMobileMapping(platform) || isWebMapping(platform));
    });

    if (!platformEntry) {
        throw new Error(`Platform mapping is not found in the configured TS paths!`);
    }

    const prefix = platformEntry[0].substr(0, platformEntry[0].indexOf("*"));
    const prefixMappedTo = platformEntry[1][0].substr(0, platformEntry[1][0].indexOf("*"));

    return {
        baseUrl,
        prefix,
        prefixMappedTo
    };
}

function createRemapFn(sourceFile: ts.SourceFile, opts: RemapOptions): (name: string) => string {
    const fileFolder = getDirname(sourceFile.fileName);
    const basePath = joinPath(opts.baseUrl, opts.prefixMappedTo);

    return (relativeImportPath) => {
        const absPathToImport = joinPath(fileFolder, relativeImportPath);

        return absPathToImport.replace(basePath, opts.prefix);
    };
}
