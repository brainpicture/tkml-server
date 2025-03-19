/**
 * Type declaration for the global context in TKML script files
 * Use this by adding a reference to the file at the top of your script:
 * 
 * /// <reference path="../types.ts" />
 */
declare global {
    /**
     * GET parameters from the URL query string
     */
    const get: Record<string, string>;

    /**
     * POST parameters from form submissions
     */
    const post: Record<string, string>;

    /**
     * Immediately ends script execution and returns the provided TKML content.
     * Any remaining script code or TKML file content will be ignored.
     * @param content TKML content to return
     */
    function finish(content: string): void;
}

// This export is needed to make the file a module
export { }; 