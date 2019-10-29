export {
    Rule as PreferMappedImportsRule,
    RemapOptions,
    RuleArgs,
    parseCompilerOptions
} from "./preferMappedImportsRule";

export { Rule as NoAndroidResourcesRule } from "./noAndroidResourcesRule";

export const rulesDirectory = ".";
export const rules = {
    "prefer-mapped-imports": [true],
    "no-android-resources": [true]
};
