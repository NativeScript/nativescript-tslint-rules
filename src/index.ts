export {
    Rule as PreferMappedImportsRule,
    RemapOptions,
    RuleArgs,
    parseCompilerOptions
} from "./preferMappedImportsRule";

export const rulesDirectory = ".";
export const rules = {
    "prefer-mapped-imports": [true]
};
