import { tsquery } from "@phenomnomnominal/tsquery";

import { Rule } from "../src/preferMappedImportsRule";

describe("prefer-mapped-imports", () => {
    it("should fail when a relative imports is used", () => {
        const sourceFile = tsquery.ast(`
            import { AppComponent } from './app.component';
        `);

        const rule = new Rule({
            ruleArguments: [],
            ruleName: "prefer-mapped-imports",
            ruleSeverity: "error",
            disabledIntervals: []
        });

        const errors = rule.apply(sourceFile);
        const [error] = errors;

        expect(errors.length).toEqual(1);
        expect(error.getFailure()).toEqual(
            expect.stringContaining("module is being loaded from a relative path. Please use a remapped path.")
        );
    });
});
