import { RuleFailure, Replacement } from "tslint";
import { SourceFile, CompilerOptions, Program } from "typescript";
import { tsquery } from "@phenomnomnominal/tsquery";

import { Rule, RuleArgs } from "../src/preferMappedImportsRule";

const baseUrl = "app/root";
const prefixMap = "src/";
const ruleArgs: RuleArgs = {
    prefix: "@src/",
    "prefix-mapped-to": prefixMap,
    "base-url": baseUrl
};

const compilerOptions: CompilerOptions = {
    baseUrl: "./app/root",
    paths: {
        "@src/*": ["src/*.tns.ts", "src/*.android.ts", "src/*.ios.ts", "src/*"]
    }
};

interface TestCase {
    testName: string;
    hasErrors: boolean;
    src: string;
    fix?: string;
    fileName: string;
    ruleArgs: RuleArgs;
    compilerOptions: CompilerOptions;
}

const TEST_CASES: Array<TestCase> = [
    {
        testName: "import sibling file",
        hasErrors: true,
        fileName: `${baseUrl}/${prefixMap}app.module.ts`,
        src: `import { AppComponent } from './app.component';`,
        fix: `import { AppComponent } from '@src/app.component';`,
        ruleArgs,
        compilerOptions
    },
    {
        testName: "import from parent folder",
        hasErrors: true,
        fileName: `${baseUrl}/${prefixMap}/feature/feature.module.ts`,
        src: `import { AppComponent } from '../app.component';`,
        fix: `import { AppComponent } from '@src/app.component';`,
        ruleArgs,
        compilerOptions
    },
    {
        testName: "import from sub-folder folder",
        hasErrors: true,
        fileName: `${baseUrl}/${prefixMap}app.module.ts`,
        src: `import { AppComponent } from './feature/feature.component';`,
        fix: `import { AppComponent } from '@src/feature/feature.component';`,
        ruleArgs,
        compilerOptions
    },
    {
        testName: "import from parent sub-folder folder",
        hasErrors: true,
        fileName: `${baseUrl}/${prefixMap}/feature/app.module.ts`,
        src: `import { AppComponent } from '../feature2/feature.component';`,
        fix: `import { AppComponent } from '@src/feature2/feature.component';`,
        ruleArgs,
        compilerOptions
    },
    {
        testName: "import from node_modules generates no error",
        hasErrors: false,
        fileName: `${baseUrl}/${prefixMap}app.module.ts`,
        src: `import { Component } from '@angular/core';`,
        ruleArgs,
        compilerOptions
    },
    {
        testName: "import non-relative path generates no error",
        hasErrors: false,
        fileName: `${baseUrl}/${prefixMap}app.module.ts`,
        src: `import { Component } from '@src/app.component';`,
        ruleArgs,
        compilerOptions
    }
];

describe("prefer-mapped-imports test cases with apply", () => {
    TEST_CASES.forEach((tc) => {
        it(tc.testName, () => {
            testRuleWithApply(tc);
        });
    });
});

describe("prefer-mapped-imports test cases with applyWithProgram", () => {
    TEST_CASES.forEach((tc) => {
        it(tc.testName, () => {
            testRuleWithApplyWithProgram(tc);
        });
    });
});

describe("prefer-mapped-imports no fix available on missing options", () => {
    const src = `import { AppComponent } from './app.component';`;
    const file = `app.module.ts`;
    function getRuleWithOptions(args: any): Rule {
        return new Rule({
            ruleArguments: [args],
            ruleName: "prefer-mapped-imports",
            ruleSeverity: "error",
            disabledIntervals: []
        });
    }

    describe("with apply", () => {
        it("missing baseUrl", () => {
            const rule = getRuleWithOptions({
                prefix: "@src/",
                "prefix-mapped-to": prefixMap
            });

            const errors = rule.apply(tsquery.ast(src, file));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });
        it("missing prefix", () => {
            const rule = getRuleWithOptions({
                "prefix-mapped-to": prefixMap,
                baseUrl: "./"
            });

            const errors = rule.apply(tsquery.ast(src, file));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });
        it("missing prefixMappedTo", () => {
            const rule = getRuleWithOptions({
                prefix: "@src/",
                baseUrl: "./"
            });

            const errors = rule.apply(tsquery.ast(src, file));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });
    });

    describe("with applyWithProgram", () => {
        const programRule = getRuleWithOptions(ruleArgs);

        it("missing baseUrl", () => {
            const options: CompilerOptions = {
                paths: {
                    "@src/*": ["src/*.tns.ts", "src/*.android.ts", "src/*.ios.ts", "src/*"]
                }
            };

            const errors = programRule.applyWithProgram(tsquery.ast(src, file), getProgramMock(options));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });

        it("missing paths", () => {
            const options: CompilerOptions = {
                baseUrl: "./app/root"
            };

            const errors = programRule.applyWithProgram(tsquery.ast(src, file), getProgramMock(options));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });

        it("missing valid paths entry", () => {
            const options: CompilerOptions = {
                baseUrl: "./app/root",
                paths: {
                    "@src/*": ["some/path/*"]
                }
            };

            const errors = programRule.applyWithProgram(tsquery.ast(src, file), getProgramMock(options));

            expect(errors.length).toEqual(1);
            expect(errors[0].hasFix()).toBeFalsy();
        });
    });
});

function getProgramMock(opts: CompilerOptions): Program {
    return <any>{ getCompilerOptions: () => opts };
}

function testRuleWithApply(tc: TestCase) {
    const applyFn = (sourceFile: SourceFile, rule: Rule) => {
        return rule.apply(sourceFile);
    };

    testCaseTemplate(tc, applyFn);
}

function testRuleWithApplyWithProgram(tc: TestCase) {
    const applyFn = (sourceFile: SourceFile, rule: Rule) => {
        return rule.applyWithProgram(sourceFile, getProgramMock(tc.compilerOptions));
    };
    testCaseTemplate(tc, applyFn);
}

function testCaseTemplate(tc: TestCase, applyFn: (sourceFile: SourceFile, rule: Rule) => Array<RuleFailure>) {
    const rule = new Rule({
        ruleArguments: [tc.ruleArgs],
        ruleName: "prefer-mapped-imports",
        ruleSeverity: "error",
        disabledIntervals: []
    });

    const sourceFile = tsquery.ast(tc.src, tc.fileName);

    const errors = applyFn(sourceFile, rule);

    if (tc.hasErrors) {
        expect(errors.length).toEqual(1);
        expect(errors[0].getFailure()).toEqual(
            expect.stringContaining("module is being loaded from a relative path. Please use a remapped path.")
        );

        const fixedResult = applyFixes(tc.src, errors);
        expect(fixedResult).toEqual(tc.fix);
    } else {
        expect(errors.length).toEqual(0);
    }
}

function applyFixes(src: string, errors: Array<RuleFailure>): string {
    const fixes = errors.filter((error) => error.hasFix()).map((error) => error.getFix()!);

    return Replacement.applyFixes(src, fixes);
}
