import Logger from './Logger';
import { LOG_TYPES, CONSOLE_LEVELS } from './logConstants';
import { arrayToString } from './logUtils';

// By default, print nothing.
const DEFAULT_CONSOLE_LEVEL = CONSOLE_LEVELS.silent;

/**
 * Abstraction layer for communicating with a global logging mechanism and
 * for creating programmatic Resin Events. Also gates what is printed
 * to the console.
 */
class LogLayer {
    /** @property {CONSOLE_LEVELS} - Level of logging allowed to the console */
    consoleLevel = DEFAULT_CONSOLE_LEVEL;

    /** @property {Object} - Reference to the global Box Logger object */
    loggerRef;

    /** @property {Object} - Reference to the global Resin object */
    resinRef;

    /**
     * @constructor
     *
     * @param {Object} config - Configures level to log for console log level and network layer.
     * @param {CONSOLE_LEVELS|string} [config.consoleLevel] - Level to set for writing to the browser console.
     * @param {boolean} [config.savingEnabled] - If true, allows the Logger to save logs to Box.
     * @param {string} [config.logURL] - Full url to save logs to. Can instead use appHost with logEndpoint (see below)
     * @param {string} [config.appHost] - Base URL to save logs to. Is combined with logEndpoint (below)
     * @param {string} [config.logEndpoint] - URL Tail to save logs to. Combined with appHost (above)
     * @param {string} [config.locale] - User's locale.
     */
    constructor(config = {}) {
        const { consoleLevel } = config;
        if (consoleLevel) {
            this.setConsoleLevel(consoleLevel);
        }

        // For now the logger exists inside of Preview, but will eventually live in
        // the consuming application. THIS IS "TEMPORARY".
        this.setupGlobalLogger(config);
    }

    /**
     * Sets the current level of messages to be logged to the console.
     *
     * @public
     * @param {CONSOLE_LEVELS|string} level - The level of logging to log to console.
     * @return {void}
     */
    setConsoleLevel(level) {
        this.consoleLevel = level;
    }

    /**
     * Interface to the Logger for info messages.
     *
     * @public
     * @param {*} args - Arguments to be printed to the console and stored in the Logger.
     * @return {void}
     */
    info(...args) {
        this.printLog(LOG_TYPES.info, args);

        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.info(...args);
    }

    /**
     * Interface to the Logger for warning messages.
     *
     * @public
     * @param {*} args - Arguments to be printed to the console and stored in the Logger.
     * @return {void}
     */
    warn(...args) {
        this.printLog(LOG_TYPES.warning, args);

        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.warn(...args);
    }

    /**
     * Interface to the Logger for error messages.
     *
     * @public
     * @param {*} args - Arguments to be printed to the console and stored in the Logger.
     * @return {void}
     */
    error(...args) {
        this.printLog(LOG_TYPES.error, args);

        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.error(...args);
    }

    /**
     * Interface to the Logger for metric messages, and print to console.
     *
     * @public
     * @param {string} eventName - Name associated with a specific metric.
     * @param {*} value - Value of the metric
     * @return {void}
     */
    metric(eventName, value) {
        this.printLog(LOG_TYPES.metric, [eventName, value]);

        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.metric(eventName, value);
    }

    /**
     * Interface for setting File object on the Logger.
     *
     * @public
     * @param {Object} file - The file with file info to attach to logs.
     * @return {void}
     */
    setFile(file) {
        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.setFile(file);
    }

    /**
     * Interface for setting content type on the Logger.
     *
     * @public
     * @param {string} type - Content type for the current logs.
     * @return {void}
     */
    setContentType(type) {
        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.setContentType(type);
    }

    /**
     * Interface for passing through network layer settings to the Logger.
     *
     * @public
     * @param {Object} config - Network related settings to pass to the Logger.
     * @param {boolean} [config.savingEnabled] - If true, allows the Logger to save logs to Box.
     * @param {string} [config.logURL] - Full url to save logs to. Can instead use appHost with logEndpoint (see below)
     * @param {string} [config.appHost] - Base URL to save logs to. Is combined with logEndpoint (below)
     * @param {string} [config.logEndpoint] - URL Tail to save logs to. Combined with appHost (above)
     * @param {string} [config.locale] - User's locale.
     * @return {void}
     */
    setupNetworkLayer(config) {
        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.setupNetworkLayer(config);
    }

    /**
     * Interface to reset file info for the Logger.
     *
     * @public
     * @return {void}
     */
    reset() {
        if (!this.boxLoggerExists()) {
            return;
        }

        this.loggerRef.reset();
    }

    /**
     * Save the current state of the Logger, for this session of this preview, and
     * clear out any old data.
     *
     * @public
     * @return {void}
     */
    save() {
        if (!this.boxLoggerExists()) {
            return;
        }

        // Only saving errors and performance metrics
        this.loggerRef.save([LOG_TYPES.error, LOG_TYPES.metric]);
        this.loggerRef.clearCache();
    }

    //--------------------------------------------------------
    // PRIVATE
    //--------------------------------------------------------

    /**
     * Maps logging type to a console printing function. Defaults to 'info = console.log'
     *
     * @private
     * @param {LOG_TYPES|string|null} type - The log type to lookup a corresponding console print method.
     * @return {Function} A function that can be invoked with a string, to print a message to the console.
     */
    getConsoleFunction(type) {
        let logFunction;
        /* eslint-disable no-console */
        switch (type) {
            case LOG_TYPES.warning:
                logFunction = console.warn;
                break;
            case LOG_TYPES.error:
            case LOG_TYPES.uncaught_error:
                logFunction = console.error;
                break;
            case LOG_TYPES.info:
            // fall through
            default:
                logFunction = console.log;
        }
        /* eslint-enable no-console */

        return logFunction;
    }

    /**
     * Determine whether or not we can print to the console, based on consoleLevel.
     *
     * @private
     * @param {LOG_TYPES|string} type - Type of log to check.
     * @return {boolean} True if we can print to the console.
     */
    canPrintLog(type) {
        let typeValue;

        switch (type) {
            case LOG_TYPES.warning:
                typeValue = CONSOLE_LEVELS.warning;
                break;
            case LOG_TYPES.error:
            case LOG_TYPES.uncaught_error:
                typeValue = CONSOLE_LEVELS.error;
                break;
            case LOG_TYPES.info:
            default:
                typeValue = CONSOLE_LEVELS.info;
        }

        return this.consoleLevel <= typeValue;
    }

    /**
     * Check to see if the global logger exists, and create a reference to it.
     *
     * @private
     * @return {boolean} True if a global Box Logger exists.
     */
    boxLoggerExists() {
        this.loggerRef = this.loggerRef || (global.Box ? global.Box.Logger : null);
        return !!this.loggerRef;
    }

    /**
     * Check to see if Resing exists, and create a reference to it.
     *
     * @private
     * @return {boolean} True if a global Resin instance exists.
     */
    resinExists() {
        this.resinRef = global.Resin;
        return !!this.resinRef;
    }

    /**
     * Print a message to the console if allowed to.
     *
     * @private
     * @param {LOG_TYPES|string} type - Type of log to check and print to the console.
     * @param {*} data - Data to print to the console.
     * @return {void}
     */
    printLog(type, data) {
        const logFunction = this.canPrintLog(type) ? this.getConsoleFunction(type) : null;
        if (logFunction) {
            const message = arrayToString(data);
            logFunction(`[${type}] ${message}`);
        }
    }

    /**
     * Create and attach listeners on this network layer, until we decide
     * how the Logger will live outside of Preview.
     *
     * @private
     * @param {Object} config - Configuration for the global logger
     * @param {boolean} [config.savingEnabled] - If true, allows the Logger to save logs to Box.
     * @param {string} [config.logURL] - Full url to save logs to. Can instead use appHost with logEndpoint (see below)
     * @param {string} [config.appHost] - Base URL to save logs to. Is combined with logEndpoint (below)
     * @param {string} [config.logEndpoint] - URL Tail to save logs to. Combined with appHost (above)
     * @param {string} [config.locale] - User's locale.
     * @return {void}
     */
    setupGlobalLogger(config) {
        if (this.boxLoggerExists()) {
            return;
        }

        global.Box = global.Box || global.Box.Logger;
        global.Box.Logger = new Logger(config);

        this.loggerRef = global.Box.Logger;
    }
}

export default LogLayer;