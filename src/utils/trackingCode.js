import { TRACKING_CODE } from '../config/constants.js'

// Format mengikuti contoh di dokumen kebutuhan: BDG-2610-0042
// = <kode wilayah>-<YYMM>-<nomor urut per bulan>

export const buildTrackingPrefix = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${TRACKING_CODE.REGION_PREFIX}-${yy}${mm}`
}

export const formatTrackingCode = (prefix, sequence) =>
  `${prefix}-${String(sequence).padStart(TRACKING_CODE.SEQUENCE_LENGTH, '0')}`

export const parseTrackingSequence = (code) => Number(code.split('-').pop())
