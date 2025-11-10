// services/image-processor.ts - 이미지 변환 코어 엔진

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  ImageProcessOptions,
  Result,
  BatchProcessItem,
  BatchProcessProgress,
  FileInfo,
  ImageFormat,
} from '../types';

/**
 * ImageProcessor - Sharp 기반 이미지 변환 엔진
 *
 * 주요 기능:
 * - 다양한 포맷 변환 (JPG, PNG, GIF, BMP, TIFF, SVG → WebP, AVIF 등)
 * - 배치 처리 (다중 파일 동시 변환)
 * - 진행 상태 추적
 * - 압축 최적화
 *
 * @example
 * ```typescript
 * const processor = new ImageProcessor();
 * const result = await processor.processImage('/path/to/image.jpg', '/path/to/output', {
 *   format: 'webp',
 *   quality: 80
 * });
 * ```
 */
export class ImageProcessor {
  private currentBatch: BatchProcessProgress | null = null;
  private isCancelled = false;

  /**
   * 단일 이미지 처리
   *
   * @param inputPath - 입력 파일 경로
   * @param outputPath - 출력 파일 경로
   * @param options - 변환 옵션
   * @returns 처리 결과
   */
  async processImage(
    inputPath: string,
    outputPath: string,
    options: ImageProcessOptions
  ): Promise<Result<FileInfo>> {
    try {
      // 1. 입력 파일 검증
      const inputExists = await this.fileExists(inputPath);
      if (!inputExists) {
        return {
          success: false,
          error: `파일을 찾을 수 없습니다: ${inputPath}`,
        };
      }

      // 2. 출력 디렉토리 생성
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // 3. Sharp 인스턴스 생성
      let sharpInstance = sharp(inputPath);

      // 4. 리사이즈 적용 (옵션)
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize(options.width, options.height, {
          fit: options.maintainAspectRatio ? 'inside' : 'fill',
          withoutEnlargement: true,
        });
      }

      // 5. 포맷 변환 및 압축
      sharpInstance = this.applyFormatOptions(sharpInstance, options);

      // 6. 파일 저장
      await sharpInstance.toFile(outputPath);

      // 7. 결과 파일 정보 가져오기
      const fileInfo = await this.getFileInfo(outputPath);

      return {
        success: true,
        data: fileInfo,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `이미지 처리 실패: ${error.message}`,
      };
    }
  }

  /**
   * 배치 처리 (다중 파일)
   *
   * @param files - 입력 파일 경로 배열
   * @param outputDir - 출력 디렉토리
   * @param options - 변환 옵션
   * @param onProgress - 진행 상태 콜백
   * @returns 배치 처리 결과
   */
  async processBatch(
    files: string[],
    outputDir: string,
    options: ImageProcessOptions,
    onProgress?: (progress: BatchProcessProgress) => void
  ): Promise<Result<BatchProcessProgress>> {
    try {
      // 초기화
      this.isCancelled = false;

      // 배치 작업 항목 생성
      const items: BatchProcessItem[] = files.map((filePath) => ({
        id: uuidv4(),
        inputPath: filePath,
        outputPath: this.generateOutputPath(filePath, outputDir, options.format),
        status: 'pending',
        progress: 0,
      }));

      // 배치 진행 상태 초기화
      this.currentBatch = {
        total: items.length,
        completed: 0,
        failed: 0,
        processing: 0,
        overallProgress: 0,
        items,
      };

      // 진행 상태 콜백 호출
      if (onProgress) {
        onProgress(this.currentBatch);
      }

      // 순차적 처리 (나중에 병렬 처리로 개선 가능)
      for (const item of items) {
        if (this.isCancelled) {
          item.status = 'failed';
          item.error = '사용자가 취소했습니다';
          this.currentBatch.failed++;
          continue;
        }

        // 항목 처리 시작
        item.status = 'processing';
        item.startTime = Date.now();
        this.currentBatch.processing++;

        // 진행 상태 업데이트
        if (onProgress) {
          onProgress(this.currentBatch);
        }

        // 이미지 처리
        const result = await this.processImage(item.inputPath, item.outputPath, options);

        // 처리 완료
        item.endTime = Date.now();
        this.currentBatch.processing--;

        if (result.success) {
          item.status = 'completed';
          item.progress = 100;
          item.convertedSize = result.data.size;
          this.currentBatch.completed++;
        } else {
          item.status = 'failed';
          item.error = result.error;
          this.currentBatch.failed++;
        }

        // 전체 진행률 계산
        this.currentBatch.overallProgress = Math.round(
          ((this.currentBatch.completed + this.currentBatch.failed) / this.currentBatch.total) * 100
        );

        // 진행 상태 콜백 호출
        if (onProgress) {
          onProgress(this.currentBatch);
        }
      }

      return {
        success: true,
        data: this.currentBatch,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `배치 처리 실패: ${error.message}`,
      };
    }
  }

  /**
   * 배치 처리 취소
   */
  cancelBatch(): void {
    this.isCancelled = true;
  }

  /**
   * 파일 정보 가져오기
   *
   * @param filePath - 파일 경로
   * @returns 파일 정보
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    const parsedPath = path.parse(filePath);

    const fileInfo: FileInfo = {
      path: filePath,
      name: parsedPath.base,
      extension: parsedPath.ext.slice(1),
      size: stats.size,
    };

    // 이미지 메타데이터 가져오기 (선택사항)
    try {
      const metadata = await sharp(filePath).metadata();
      fileInfo.width = metadata.width;
      fileInfo.height = metadata.height;
    } catch (error) {
      // 메타데이터를 가져올 수 없는 경우 무시
    }

    return fileInfo;
  }

  /**
   * 지원하는 입력 포맷 확인
   *
   * @param filePath - 파일 경로
   * @returns 지원 여부
   */
  isSupportedFormat(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const supportedFormats = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif',
      'webp', 'avif', 'svg', 'heif', 'heic'
    ];
    return supportedFormats.includes(ext);
  }

  /**
   * 포맷별 옵션 적용
   *
   * @param sharpInstance - Sharp 인스턴스
   * @param options - 변환 옵션
   * @returns Sharp 인스턴스
   */
  private applyFormatOptions(
    sharpInstance: sharp.Sharp,
    options: ImageProcessOptions
  ): sharp.Sharp {
    const { format, quality, compressionLevel = 6 } = options;

    switch (format) {
      case 'webp':
        return sharpInstance.webp({
          quality,
          effort: compressionLevel, // 0-6, 높을수록 느리지만 작은 파일
        });

      case 'avif':
        return sharpInstance.avif({
          quality,
          effort: compressionLevel, // 0-9, 높을수록 느리지만 작은 파일
        });

      case 'jpg':
        return sharpInstance.jpeg({
          quality,
          progressive: true,
          mozjpeg: true, // MozJPEG 압축 사용
        });

      case 'png':
        return sharpInstance.png({
          quality,
          compressionLevel: compressionLevel > 6 ? 9 : compressionLevel, // 0-9
          progressive: true,
        });

      case 'tiff':
        return sharpInstance.tiff({
          quality,
          compression: 'lzw',
        });

      case 'gif':
        return sharpInstance.gif({
          progressive: true,
        });

      case 'bmp':
        // BMP는 Sharp의 toFormat에 직접 전달 가능하지만 타입 안정성을 위해 any 사용
        return sharpInstance.toFormat('bmp' as any);

      default:
        // 기본값: webp
        return sharpInstance.webp({ quality, effort: compressionLevel });
    }
  }

  /**
   * 출력 파일 경로 생성
   *
   * @param inputPath - 입력 파일 경로
   * @param outputDir - 출력 디렉토리
   * @param format - 출력 포맷
   * @returns 출력 파일 경로
   */
  private generateOutputPath(
    inputPath: string,
    outputDir: string,
    format: ImageFormat
  ): string {
    const parsedPath = path.parse(inputPath);
    const newFileName = `${parsedPath.name}.${format}`;
    return path.join(outputDir, newFileName);
  }

  /**
   * 파일 존재 여부 확인
   *
   * @param filePath - 파일 경로
   * @returns 존재 여부
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스 (Main Process에서 사용)
export const imageProcessor = new ImageProcessor();
