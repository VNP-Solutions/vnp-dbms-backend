import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'

/** Maximum lifetime AWS SigV4 allows for a presigned URL. */
export const S3_PRESIGNED_URL_MAX_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * Uploads generated (in-memory) report buffers to S3 and hands back a
 * time-limited presigned link.
 *
 * Kept separate from FileUploadService: that service is built around
 * user-uploaded Multer files bound to portfolios, whereas generated exports
 * are transient artefacts with no File record behind them.
 */
@Injectable()
export class S3ExportUtil {
  private readonly s3Client: S3Client
  private readonly bucketName: string

  constructor(private readonly configService: ConfigService) {
    const s3Config = this.configService.s3

    this.s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey
      }
    })

    this.bucketName = s3Config.bucketName
  }

  /**
   * Uploads a buffer and returns a presigned GET url for it.
   *
   * The object is NOT made public — exports can contain decrypted OTA
   * credentials, so the emailed link is the only way in and it expires.
   */
  async uploadAndGetPresignedUrl(
    key: string,
    body: Buffer,
    contentType: string,
    expiresInSeconds: number = S3_PRESIGNED_URL_MAX_TTL_SECONDS
  ): Promise<string> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType
        }
      })

      await upload.done()

      return await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
        {
          expiresIn: Math.min(
            expiresInSeconds,
            S3_PRESIGNED_URL_MAX_TTL_SECONDS
          )
        }
      )
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload export to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
