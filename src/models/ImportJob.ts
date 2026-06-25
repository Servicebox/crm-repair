import mongoose, { Document, Model, Schema } from 'mongoose'

export type ImportFileType = 'csv' | 'xml' | 'xlsx' | 'xls'
export type ImportStatus =
  | 'uploaded'
  | 'analyzing'
  | 'ready_for_mapping'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type DuplicateStrategy = 'skip' | 'update' | 'create' | 'merge'

export interface IColumnAnalysis {
  source_name: string
  sample_values: string[]
  suggested_target: string
  confidence: number
}

export interface IFieldMapping {
  source_column: string
  target_field: string
  transformer: string
  default_value?: unknown
  is_required: boolean
}

export interface IImportError {
  row_number: number
  source_data: unknown
  error_message: string
  error_code: string
}

export interface IImportJob {
  _id: mongoose.Types.ObjectId
  organization_id: mongoose.Types.ObjectId
  created_by: mongoose.Types.ObjectId
  file_type: ImportFileType
  original_filename: string
  storage_path: string
  target_entity: string
  selected_sheet?: string

  analysis: {
    total_rows: number
    detected_columns: IColumnAnalysis[]
    encoding: string
    sheets: string[]
  }

  mapping: IFieldMapping[]
  duplicate_strategy: DuplicateStrategy

  status: ImportStatus
  progress: {
    processed: number
    total: number
    successful: number
    failed: number
    duplicates_skipped: number
  }

  import_errors: IImportError[]
  created_at: Date
  started_at?: Date
  completed_at?: Date
}

export type ImportJobDocument = IImportJob & Document

const ColumnAnalysisSchema = new Schema<IColumnAnalysis>(
  {
    source_name: String,
    sample_values: [String],
    suggested_target: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
  },
  { _id: false }
)

const FieldMappingSchema = new Schema<IFieldMapping>(
  {
    source_column: { type: String, required: true },
    target_field: { type: String, required: true },
    transformer: { type: String, default: 'none' },
    default_value: { type: Schema.Types.Mixed },
    is_required: { type: Boolean, default: false },
  },
  { _id: false }
)

const ImportErrorSchema = new Schema<IImportError>(
  {
    row_number: Number,
    source_data: { type: Schema.Types.Mixed },
    error_message: String,
    error_code: String,
  },
  { _id: false }
)

const ImportJobSchema = new Schema<IImportJob>(
  {
    organization_id: { type: Schema.Types.ObjectId, required: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    file_type: { type: String, enum: ['csv', 'xml', 'xlsx', 'xls'], required: true },
    original_filename: { type: String, default: '' },
    storage_path: { type: String, default: '' },
    target_entity: { type: String, default: 'clients' },
    selected_sheet: String,

    analysis: {
      total_rows: { type: Number, default: 0 },
      detected_columns: [ColumnAnalysisSchema],
      encoding: { type: String, default: 'UTF-8' },
      sheets: [String],
    },

    mapping: [FieldMappingSchema],
    duplicate_strategy: {
      type: String,
      enum: ['skip', 'update', 'create', 'merge'],
      default: 'skip',
    },

    status: {
      type: String,
      enum: ['uploaded', 'analyzing', 'ready_for_mapping', 'importing', 'completed', 'failed', 'cancelled'],
      default: 'uploaded',
    },

    progress: {
      processed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      successful: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      duplicates_skipped: { type: Number, default: 0 },
    },

    import_errors: { type: [ImportErrorSchema], default: [] },
    started_at: Date,
    completed_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
)

ImportJobSchema.index({ organization_id: 1, created_at: -1 })
ImportJobSchema.index({ organization_id: 1, status: 1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ImportJob: Model<any> =
  mongoose.models.ImportJob ?? mongoose.model('ImportJob', ImportJobSchema)
export default ImportJob
