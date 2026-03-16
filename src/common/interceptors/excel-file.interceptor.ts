import { BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface'

const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
]

export const ExcelFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only Excel files (.xlsx, .xls) and CSV files are allowed.'
        ),
        false
      )
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
} as MulterOptions)
