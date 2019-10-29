import { Rule } from "../src/noAndroidResourcesRule";
import { tsquery } from "@phenomnomnominal/tsquery";

const failCases = [
    { errorCount: 1, src: "dialog.getWindow().setWindowAnimations(android.R.style.Animation_Dialog);" },
    { errorCount: 2, src: "fragmentTransaction.setCustomAnimations(android.R.anim.fade_in, android.R.anim.fade_out);" },
    { errorCount: 1, src: "var fadeIn = android.R.anim.fade_in;" }
];

const noFailCases = ["var R = 3;", "var x = android.something.R"];

describe("prefer-mapped-imports test cases with apply", () => {
    const rule = new Rule({
        ruleArguments: [],
        ruleName: "no-android-resources",
        ruleSeverity: "error",
        disabledIntervals: []
    });

    failCases.forEach(({ src, errorCount }) =>
        it(`Source "${src}" should produce an error`, () => {
            const results = rule.apply(tsquery.ast(src));

            expect(results.length).toBe(errorCount);
            results.forEach((fail) => expect(fail.getFailure()).toContain("Use of android.R is forbidden"));
        })
    );

    noFailCases.forEach((src) =>
        it(`Source "${src}" should NOT produce an error`, () => {
            const results = rule.apply(tsquery.ast(src));

            expect(results.length).toBe(0);
        })
    );
});
