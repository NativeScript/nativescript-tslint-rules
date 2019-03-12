import * as ts from "typescript";
import * as Lint from "tslint";
import * as tsutils from "tsutils";
import { join as joinPath, dirname as getDirname } from "path";

interface WalkerOptions {
    platformRemapFn?: (name: string) => string;
}

const OPTION_IMPORT_PREFIX = "import-prefix";

// TODO: Add documentation for the recommended remapped paths and link it in the error message.
const FAILURE_BODY_RELATIVE = "module is being loaded from a relative path. Please use a remapped path.";
const FAILURE_BODY_INSIDE = "module path should not contain reference to current or parent directory inside";

// Looks for path separator `/` or `\\`(Windows style)
// followed than one or two dot characters
// followed by path separator (same as initial).
const illegalInsideRegex = /(\/|\\)\.\.?\1/;

export class Rule extends Lint.Rules.OptionallyTypedRule {
    static readonly metadata: Lint.IRuleMetadata = {
        ruleName: "relative-to-mapped-imports",
        type: "maintainability",
        description: "Prefer using mapped paths when importing external modules or ES6 import declarations.",
        options: {
            type: "array",
            items: {
                type: "string",
                enum: [OPTION_IMPORT_PREFIX]
            },
            minLength: 0,
            maxLength: 1
        },
        optionsDescription: `One argument may be optionally provided: \n\n' +
            '* \`${OPTION_IMPORT_PREFIX}\` specifies the prefix for the mapped imports.`,
        typescriptOnly: false,
        // TODO: Add documentation for the recommended remapped paths and link it in the rationale.
        rationale: "..."
    };
    
    apply(sourceFile: ts.SourceFile) {
        const ruleOptions = this.getOptions();
        const walkerOptions = this.parseRuleOptions(ruleOptions);

        return this.applyWithFunction(sourceFile, walk, walkerOptions);
    }

    applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Array<Lint.RuleFailure> {
        const compilerOptions = program.getCompilerOptions();
        if (!compilerOptions) {
            throw new Error(`Base URL and path mappings must be specified as TS compiler options!`);
        }
        const ruleOptions = this.parseCompilerOptions(compilerOptions);

        return this.applyWithFunction(sourceFile, walk, ruleOptions);
    }

    private parseRuleOptions(options: Lint.IOptions): WalkerOptions {
        const prefix = (<any>options).importPrefix;

        if (!prefix) {
            return {};
        }

        const platformRemapFn = (relativePath: string) => {
            // TODO: Properly detect the relative parts of the import path
            const basePath = "./";

            return relativePath.replace(basePath, prefix);
        };

        return {
            platformRemapFn
        };
    }

    private parseCompilerOptions(compilerOptions: ts.CompilerOptions): WalkerOptions {
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

        const isMobileMapping = (path: string) =>
            ["tns", "android", "ios"].some((platform) => path.includes(platform));
        const isWebMapping = (path: string) => path.includes("web");

        const platformEntry = entries.find((entry) => {
            // entry[0] -> @src/*
            // entry[1] -> [src/*.web, src/*]
            const platforms = entry[1];

            return platforms.some((platform) =>
                isMobileMapping(platform) || isWebMapping(platform)
            );
        });

        if (!platformEntry) {
            throw new Error(`Platform mapping is not found in the configured TS paths!`);
        }

        const platformRemapFn = (relativePath: string) => {
            // TODO: Properly detect the relative parts of the import path
            const basePath = "./";

            return relativePath.replace(basePath, platformEntry[0].substr(0, platformEntry[0].indexOf("*")));
        };

        return {
            platformRemapFn
        };

    }
}

function walk(ctx: Lint.WalkContext<WalkerOptions>) {
    const dirname = getDirname(ctx.sourceFile.fileName);
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
                ctx.addFailureAt(node.getStart(), node.getWidth(), `External ${errorBody}: ${node.getText()}`);
            }
        } else if (tsutils.isImportDeclaration(node)) {
            const errorBody = getValidationErrorBody(node.moduleSpecifier);

            if (errorBody !== undefined) {
                if (!platformRemapFn) {
                    ctx.addFailureAt(node.getStart(), node.getWidth(), `Imported ${errorBody}: ${node.getText()}`);
                } else {
                    // Create a fix
                    const moduleSpecifier = (<ts.ImportDeclaration>node).moduleSpecifier;
                    const imp = moduleSpecifier.getText().substr(1, moduleSpecifier.getText().length - 2);
                    const absoluteModuleSpecifierPath = joinPath(dirname, imp);
                    const remappedImport = `'${platformRemapFn(absoluteModuleSpecifierPath)}'`;

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
