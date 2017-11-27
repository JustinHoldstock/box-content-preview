// Set of Transformers that translate data for storage
import { getISOTime } from './logUtils';
import { LOG_CODES } from './logConstants';
import { METRIC_CONTROL } from './metricsConstants';

/**
 * Creates basic structure for all lgos to be saved.
 *
 * @param {string} event - Type of event being logged.
 * @return {Object} The base container object for storing logs.
 */
function makeBatchContainer(event) {
    return {
        event_type: event,
        events: []
    };
}

/**
 * Create a generic batch of logs.
 *
 * @param {string} event - Type of event being logged.
 * @param {Object[]} logs - List of logs.
 * @return {Object} A log batch.
 */
function transformGeneric(event, logs) {
    const batch = makeBatchContainer(event);

    logs.forEach((log) => {
        const { timestamp, message } = log;
        batch.events.push({
            timestamp,
            value: message,
            code: event
        });
    });

    return batch;
}

/**
 * Creates a batch of logs for warning events.
 *
 * @param {Object[]} logs - List of warning logs.
 * @return {Object} The transformed log batch.
 */
export function transformWarnings(logs) {
    return transformGeneric(LOG_CODES.warning, logs);
}

/**
 * Creates a batch of logs for info events.
 *
 * @param {Object[]} logs - List of info logs.
 * @return {Object} The transformed log batch.
 */
export function transformInfo(logs) {
    return transformGeneric(LOG_CODES.info, logs);
}

/**
 * Creates a batch of logs for error events.
 *
 * @param {Object[]} logs - List of error logs.
 * @return {Object} The transformed log batch.
 */
export function transformErrors(logs) {
    return transformGeneric(LOG_CODES.error, logs);
}

/**
 * Creates a batch of logs for metric events.
 *
 * @param {Object[]} logs - List of metric logs.
 * @return {Object} The transformed log batch.
 */
export function transformMetrics(logs) {
    const batch = makeBatchContainer(LOG_CODES.metric);
    const controlEvents = [];

    logs.forEach((log) => {
        const { timestamp, message } = log;
        const { metricCode, metricValue } = message;

        if (metricCode === METRIC_CONTROL) {
            controlEvents.push({
                timestamp,
                code: metricValue // The value of a metric is the metric code of the action event
            });
        } else {
            batch.events.push({
                timestamp,
                code: metricCode,
                value: metricValue
            });
        }
    });

    if (controlEvents.length) {
        batch.events.push({
            timestamp: getISOTime(),
            code: METRIC_CONTROL,
            value: controlEvents
        });
    }

    return batch;
}

/**
 * event_type: <ERROR | METRIC | WARNING | INFO>,
   events: [
       {
           timestamp,
           code,
           value
       }
   ]
 */