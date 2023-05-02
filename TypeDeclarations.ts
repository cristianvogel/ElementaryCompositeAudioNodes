/**
 * @file TypeDeclerations.ts
 * @description Type declarations for the library
 */

import { NodeRepr_t } from '@elemaudio/core'

export type Signal = NodeRepr_t;
export type SignalCompositeArgs = { props: any; children: Signal[] };