// Public runtime configuration. A Supabase publishable key is safe for browser use;
// secret/service-role keys must never be placed in this file.
globalThis.MathSurvivalCloudRuntime = Object.freeze({
    provider: 'gas',
    supabaseUrl: '',
    supabasePublishableKey: '',
    fallbackReadsToGas: true
});
