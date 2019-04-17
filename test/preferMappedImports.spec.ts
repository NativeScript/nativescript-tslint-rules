import { RuleFailure, Replacement } from "tslint";
import { isArray } from "util";
import { SourceFile, CompilerOptions } from "typescript";
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

function testRuleWithApply(tc: TestCase) {
    const applyFn = (sourceFile: SourceFile, rule: Rule) => {
        return rule.apply(sourceFile);
    };

    testCaseTemplate(tc, applyFn);
}

function testRuleWithApplyWithProgram(tc: TestCase) {
    const programMock = {
        getCompilerOptions: () => tc.compilerOptions
    };

    const applyFn = (sourceFile: SourceFile, rule: Rule) => {
        return rule.applyWithProgram(sourceFile, <any>programMock);
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
    const fixes = errors.reduce((cur, fail) => {
        const failFixes = fail.getFix();
        if (isArray(failFixes)) {
            return cur.concat(failFixes);
        } else if (failFixes) {
            return cur.concat([failFixes]);
        } else {
            return cur;
        }
    }, new Array<Replacement>());

    return Replacement.applyFixes(src, fixes);
}
