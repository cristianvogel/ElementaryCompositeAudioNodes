/**
 * ElementaryAudio 🍄 CompositeNodes
 * author: @cristianvogel
 * https://www.elementary.audio/docs/guides/Understanding_Memoization#composite-nodes
 */

import { createNode, el, resolve } from '@elemaudio/core';
import type { Signal, SignalCompositeArgs } from './TypeDeclarations';


/**
 * @name constants
 * @description Useful signal constants for normalised system
 */
const one: Signal = el.const({ key: 'one', value: 1 });
const negativeOne: Signal = el.const({ key: 'minusOne', value: -1 });
const zero: Signal = el.const({ key: 'zero', value: 0 });
const half: Signal = el.const({ key: 'half', value: 0.5 });
const negativeHalf: Signal = el.const({ key: 'minusHalf', value: -0.5 });
const halfSR: Signal = el.mul(0.5, el.sr());

/**
 * @name detunedSaws
 * @description Dual detuned sawtooth oscillators example from the ElementaryAudio docs
 */

function _dualSaw({ props, children }: SignalCompositeArgs): Signal {
    const frequency: Signal = children[0];
    return resolve(
        el.mul(
            props.ampMod,
            0.5,
            el.add(el.blepsaw(frequency), el.blepsaw(el.mul(1.01, frequency)))
        )
    );
}

export function detunedSaws(
    props: { ampMod: Signal | number },
    frequency: Signal | number
): Signal {
    return createNode(_dualSaw, props, [frequency]);
}


/** 
 * @name stereoizeParam 
 * @description Cast a number to StereoSignal type
*/

export function stereoizeParam(signal: number): StereoSignal {
    const toSignal = el.const({ key: 'stereoize', value: signal })
    return { left: toSignal, right: toSignal };
}

/** 
 * @name stereoizeSignal
 * @description Cast a single Signal to StereoSignal type
 */
export function stereoizeSignal(signal: Signal): StereoSignal {
    return { left: signal, right: signal };
}

/**
 * @name numberToSignal
 * @description Cast a number to constant Signal
 * 
 */
export function numberToConstant(signal: number, key?: string): Signal {
    const K = key ? key : Utils.generateRandomKey();
    return el.const({ key, value: signal });
}


/**
 * @name attenuate
 * @description Attenuate by another a level signal, with smoothing true by default
 * @param props { level, key, bypassSmoothing }
 * @param level [ signal or number ] :: level to attenuate by
 * @param key [ string ] :: optional key for the node
 * @param bypassSmoothing [ boolean ] :: bypass default smoothing
 */

function _attenuate({ props, children }: SignalCompositeArgs): Signal {
    const input: Signal = children[0];
    const level: Signal = props.bypassSmoothing ? props.level : el.sm(props.level);
    const key = props.key ? props.key : 'attenuator';
    return resolve(el.mul({ key: key }, level, input));
}

export function attenuate(
    props: {
        level: Signal | number;
        key?: string;
        bypassSmoothing?: boolean
    },
    signal: Signal
): Signal {
    return createNode(_attenuate, props, [signal]);
}

/**
 * @name progressCounter
 * @description Implements a parametised counter as an audio rate signal, 
 * with the side effect of emitting a snapshot of a normalised progress value emitted at a specified rate. 
 * This is an audio rate control signal, therefore it will also emit DC when rendered. 
 * One strategy is to render it with a secondary Elementary core, 
 * which is not connected to the audio output, and then use the snapshot to drive 
 * a UI progress bar or anything else code wise. The advantage of this approach is that
 * the progress signal can be further modified by signal processing, like smoothing and so on. 
 
 * @param props { run, totalDurMs, rate, startOffset }
 * @param run [ signal or number ] :: run or pause the counter
 * @param totalDurMs [ number ] :: total duration of the counter in milliseconds
 * @param rate [ number ] :: snapshot rate in Hz
 * @param startOffset [ number ] :: start offset in milliseconds
 */

function _progress({ props, children }: SignalCompositeArgs): Signal {
    let { run, totalDurMs, rate = 10, startOffset = 0 } = props;
    const key = props.key ? props.key + '_ss' : 'progress';
    let progress = el.add(
        el.counter({ key: key + '_count' }, el.const({ key: key + '_run', value: run })),
        el.ms2samps(startOffset)
    );
    let normProgress = el.div({ key: key + '_div' }, progress, el.ms2samps(totalDurMs));
    return resolve(
        el.snapshot({ key, name: 'progress' }, el.train(rate ? rate * run : run), normProgress)
    );
}

export function progress(props: {
    key?: string;
    totalDurMs?: number;
    run: Signal | number;
    rate?: number;
    startOffset?: number;
}): Signal {
    return createNode(_progress, props, []);
}


/**
 * @name clippedHann
 * @description A clipped hann window with optional pre-scaling
 * @param props { gain } :: optional gain before clipping
 * @param index [ signal or number ] :: phase index into the hann window lookup table
 * 
 */

function _clippedHann({ props, children }: SignalCompositeArgs): Signal {
    let index: number | Signal = children[0];
    if (!isNode(index)) { index = numberToConstant(index as unknown as number); }
    const gain = props.gain ? props.gain : one;
    return resolve(
        clipTo01({ prescale: gain, fullRangeInput: false }, resolve(el.hann(index)))
    )
}

export function clippedHann(
    props: {
        key?: string;
        gain?: number | Signal;
    },
    index: Signal | number,
): Signal {
    return createNode(_clippedHann, props, [index]);
}


/**
 * @name clipTo01
 * @description Clip a signal to the range [0, 1] with optional pre-scaling
 * @param signal expects full range [-1,1] signal
 */

function _clipTo01({ props, children }: SignalCompositeArgs): Signal {
    const input = children[0];
    const prescale: number | Signal = props.prescale ? props.prescale : one;
    const scaleAndOffset = props.fullRangeInput ? fullRangeTo01(input) as Signal : input;
    const final = el.mul(prescale, scaleAndOffset) as Signal;
    return resolve(
        el.max(0, el.min(1, final))
    )
}

export function clipTo01(
    props: {
        prescale?: number | Signal,
        fullRangeInput?: boolean;
    },
    signal: Signal): Signal {
    return createNode(_clipTo01, props, [signal]);
}

/**
 * @name fullRangeTo01
 * @description Convert a full range signal to the range [0, 1]
 * @param signal expects full range [-1,1] signal
 */

function _fullRangeTo01({ children }: SignalCompositeArgs): Signal {
    const input = children[0];

    return resolve(
        el.add(half, el.mul(half, input))
    )
}

export function fullRangeTo01(signal: Signal): Signal {
    return createNode(_fullRangeTo01, {}, [signal]);
}