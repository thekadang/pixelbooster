/**
 * BackupManager - 백업 시스템 관리
 *
 * 이미지 변환 전 원본 파일을 백업하고, 필요 시 복원하는 기능 제공
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  Result,
  BackupInfo,
  BackupFilters,
  BackupProgress,
  BackupBatchResult,
  BackupIndex,
} from '../types';

export class BackupManager {
  private backupDir: string;
  private indexPath: string;

  constructor() {
    // backup 폴더 경로 설정
    this.backupDir = path.join(process.cwd(), 'backup');
    this.indexPath = path.join(this.backupDir, 'metadata_index.json');
  }

  /**
   * 단일 파일 백업
   *
   * @param filePath - 원본 파일 경로
   * @returns 백업 정보
   */
  async backupFile(filePath: string): Promise<Result<BackupInfo>> {
    try {
      // 1. 원본 파일 존재 확인
      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        return {
          success: false,
          error: `파일을 찾을 수 없습니다: ${filePath}`,
        };
      }

      // 2. 파일 정보 조회
      const stats = await fs.stat(filePath);
      const filename = path.basename(filePath);

      // 3. 백업 디렉토리 생성 (backup/YYYY-MM-DD/)
      const now = new Date();
      const dateFolder = this.formatDateFolder(now);
      const backupDateDir = path.join(this.backupDir, dateFolder);
      await this.ensureDirectory(backupDateDir);

      // 4. 백업 파일명 생성
      const backupFilename = this.getBackupFileName(filename, now);
      const backupPath = path.join(backupDateDir, backupFilename);

      // 5. 파일 복사
      await fs.copyFile(filePath, backupPath);

      // 6. 파일 해시 계산
      const hash = await this.calculateHash(backupPath);

      // 7. 백업 정보 생성
      const backupId = `backup_${this.formatTimestamp(now)}_${uuidv4().slice(0, 8)}`;
      const backupInfo: BackupInfo = {
        backupId,
        originalPath: filePath,
        backupPath,
        filename,
        fileSize: stats.size,
        fileSizeReadable: this.formatFileSize(stats.size),
        backupDate: now,
        hash,
        status: 'active',
      };

      // 8. 메타데이터 저장
      const metadataPath = path.join(backupDateDir, `${backupFilename}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2), 'utf-8');

      // 9. 전체 인덱스 업데이트
      await this.updateIndex(backupInfo);

      return {
        success: true,
        data: backupInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: `파일 백업 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 배치 파일 백업
   *
   * @param files - 원본 파일 경로 배열
   * @param onProgress - 진행 상태 콜백
   * @returns 백업 결과
   */
  async backupBatch(
    files: string[],
    onProgress?: (progress: BackupProgress) => void
  ): Promise<Result<BackupBatchResult>> {
    const result: BackupBatchResult = {
      successCount: 0,
      failedCount: 0,
      successBackups: [],
      failedFiles: [],
    };

    const total = files.length;
    let completed = 0;
    let failed = 0;

    try {
      for (const filePath of files) {
        // 진행 상태 업데이트
        if (onProgress) {
          onProgress({
            total,
            completed,
            failed,
            processing: 1,
            overallProgress: Math.round((completed / total) * 100),
            currentFile: path.basename(filePath),
          });
        }

        // 파일 백업
        const backupResult = await this.backupFile(filePath);

        if (backupResult.success && backupResult.data) {
          result.successCount++;
          result.successBackups.push(backupResult.data);
          completed++;
        } else {
          result.failedCount++;
          const errorMessage = backupResult.success ? '알 수 없는 오류' : backupResult.error;
          result.failedFiles.push({
            filePath,
            error: errorMessage,
          });
          failed++;
        }
      }

      // 최종 진행 상태 업데이트
      if (onProgress) {
        onProgress({
          total,
          completed,
          failed,
          processing: 0,
          overallProgress: 100,
        });
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `배치 백업 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 백업 파일 복원
   *
   * @param backupId - 백업 ID
   * @param targetPath - 복원 대상 경로 (옵션, 미제공 시 원본 경로)
   * @returns 복원된 파일 경로
   */
  async restoreFile(backupId: string, targetPath?: string): Promise<Result<string>> {
    try {
      // 1. 백업 메타데이터 조회
      const backupInfo = await this.findBackupById(backupId);
      if (!backupInfo) {
        return {
          success: false,
          error: `백업을 찾을 수 없습니다: ${backupId}`,
        };
      }

      // 2. 백업 파일 존재 확인
      const backupExists = await this.fileExists(backupInfo.backupPath);
      if (!backupExists) {
        return {
          success: false,
          error: `백업 파일이 손상되었거나 삭제되었습니다: ${backupInfo.backupPath}`,
        };
      }

      // 3. 복원 대상 경로 결정
      const restorePath = targetPath || backupInfo.originalPath;

      // 4. 대상 경로에 파일이 이미 존재하는지 확인
      const targetExists = await this.fileExists(restorePath);
      if (targetExists) {
        // 파일이 이미 존재하면 덮어쓰기 (실제 UI에서는 확인 필요)
        console.warn(`파일이 이미 존재합니다. 덮어씁니다: ${restorePath}`);
      }

      // 5. 대상 디렉토리 생성
      const targetDir = path.dirname(restorePath);
      await this.ensureDirectory(targetDir);

      // 6. 파일 복사
      await fs.copyFile(backupInfo.backupPath, restorePath);

      // 7. 복원 완료 메타데이터 업데이트
      backupInfo.status = 'restored';
      backupInfo.restoredAt = new Date();

      const backupDateDir = path.dirname(backupInfo.backupPath);
      const backupFilename = path.basename(backupInfo.backupPath);
      const metadataPath = path.join(backupDateDir, `${backupFilename}.json`);
      await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2), 'utf-8');

      // 8. 전체 인덱스 업데이트
      await this.updateIndex(backupInfo);

      return {
        success: true,
        data: restorePath,
      };
    } catch (error) {
      return {
        success: false,
        error: `파일 복원 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 배치 파일 복원
   *
   * @param backupIds - 백업 ID 배열
   * @param onProgress - 진행 상태 콜백
   * @returns 복원 결과
   */
  async restoreBatch(
    backupIds: string[],
    onProgress?: (progress: BackupProgress) => void
  ): Promise<Result<BackupBatchResult>> {
    const result: BackupBatchResult = {
      successCount: 0,
      failedCount: 0,
      successBackups: [],
      failedFiles: [],
    };

    const total = backupIds.length;
    let completed = 0;
    let failed = 0;

    try {
      for (const backupId of backupIds) {
        // 진행 상태 업데이트
        if (onProgress) {
          onProgress({
            total,
            completed,
            failed,
            processing: 1,
            overallProgress: Math.round((completed / total) * 100),
            currentFile: backupId,
          });
        }

        // 파일 복원
        const restoreResult = await this.restoreFile(backupId);

        if (restoreResult.success) {
          result.successCount++;
          completed++;
        } else {
          result.failedCount++;
          result.failedFiles.push({
            filePath: backupId,
            error: restoreResult.error || '알 수 없는 오류',
          });
          failed++;
        }
      }

      // 최종 진행 상태 업데이트
      if (onProgress) {
        onProgress({
          total,
          completed,
          failed,
          processing: 0,
          overallProgress: 100,
        });
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `배치 복원 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 백업 목록 조회
   *
   * @param filters - 필터 옵션
   * @returns 백업 목록
   */
  async listBackups(filters?: BackupFilters): Promise<Result<BackupInfo[]>> {
    try {
      // 전체 인덱스 읽기
      const index = await this.loadIndex();
      let backups = [...index.backups];

      // 필터 적용
      if (filters) {
        // 시작 일자 필터
        if (filters.startDate) {
          backups = backups.filter((backup) => {
            const backupDate = new Date(backup.backupDate);
            return backupDate >= filters.startDate!;
          });
        }

        // 종료 일자 필터
        if (filters.endDate) {
          backups = backups.filter((backup) => {
            const backupDate = new Date(backup.backupDate);
            return backupDate <= filters.endDate!;
          });
        }

        // 파일명 필터 (부분 일치)
        if (filters.filename) {
          const lowerFilename = filters.filename.toLowerCase();
          backups = backups.filter((backup) =>
            backup.filename.toLowerCase().includes(lowerFilename)
          );
        }

        // 상태 필터
        if (filters.status) {
          backups = backups.filter((backup) => backup.status === filters.status);
        }

        // 정렬
        if (filters.sortBy) {
          backups = this.sortBackups(backups, filters.sortBy, filters.sortOrder || 'desc');
        }
      }

      return {
        success: true,
        data: backups,
      };
    } catch (error) {
      return {
        success: false,
        error: `백업 목록 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 백업 삭제
   *
   * @param backupId - 백업 ID
   * @returns 삭제 결과
   */
  async deleteBackup(backupId: string): Promise<Result<void>> {
    try {
      // 1. 백업 메타데이터 조회
      const backupInfo = await this.findBackupById(backupId);
      if (!backupInfo) {
        return {
          success: false,
          error: `백업을 찾을 수 없습니다: ${backupId}`,
        };
      }

      // 2. 백업 파일 삭제
      const backupExists = await this.fileExists(backupInfo.backupPath);
      if (backupExists) {
        await fs.unlink(backupInfo.backupPath);
      }

      // 3. 메타데이터 파일 삭제
      const backupDateDir = path.dirname(backupInfo.backupPath);
      const backupFilename = path.basename(backupInfo.backupPath);
      const metadataPath = path.join(backupDateDir, `${backupFilename}.json`);
      const metadataExists = await this.fileExists(metadataPath);
      if (metadataExists) {
        await fs.unlink(metadataPath);
      }

      // 4. 전체 인덱스에서 제거
      await this.removeFromIndex(backupId);

      // 5. 빈 디렉토리 정리
      await this.cleanEmptyDirectories();

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `백업 삭제 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * 디렉토리 생성 (없으면)
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 파일 존재 확인
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * SHA-256 해시 계산
   */
  private async calculateHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fsSync.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
      stream.on('error', reject);
    });
  }

  /**
   * 백업 파일명 생성
   * {원본파일명}_{백업일시}.{확장자}
   */
  private getBackupFileName(filename: string, date: Date): string {
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const timestamp = this.formatTimestamp(date);
    return `${basename}_${timestamp}${ext}`;
  }

  /**
   * 날짜 폴더명 포맷 (YYYY-MM-DD)
   */
  private formatDateFolder(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 타임스탬프 포맷 (YYYYMMDD_HHmmss)
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * 파일 크기 포맷 (읽기 쉬운 형식)
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * 전체 인덱스 로드
   */
  private async loadIndex(): Promise<BackupIndex> {
    try {
      await this.ensureDirectory(this.backupDir);

      const indexExists = await this.fileExists(this.indexPath);
      if (!indexExists) {
        // 인덱스 파일이 없으면 새로 생성
        const newIndex: BackupIndex = {
          version: '1.0',
          lastUpdated: new Date(),
          totalBackups: 0,
          totalSize: 0,
          backups: [],
        };
        await fs.writeFile(this.indexPath, JSON.stringify(newIndex, null, 2), 'utf-8');
        return newIndex;
      }

      const content = await fs.readFile(this.indexPath, 'utf-8');
      const index: BackupIndex = JSON.parse(content);

      // Date 객체로 변환
      index.lastUpdated = new Date(index.lastUpdated);
      index.backups = index.backups.map((backup) => ({
        ...backup,
        backupDate: new Date(backup.backupDate),
        restoredAt: backup.restoredAt ? new Date(backup.restoredAt) : undefined,
      }));

      return index;
    } catch (error) {
      console.error('인덱스 로드 실패:', error);
      // 에러 시 빈 인덱스 반환
      return {
        version: '1.0',
        lastUpdated: new Date(),
        totalBackups: 0,
        totalSize: 0,
        backups: [],
      };
    }
  }

  /**
   * 전체 인덱스 업데이트
   */
  private async updateIndex(backupInfo: BackupInfo): Promise<void> {
    try {
      const index = await this.loadIndex();

      // 기존 백업 찾기 (업데이트 or 추가)
      const existingIndex = index.backups.findIndex((b) => b.backupId === backupInfo.backupId);

      if (existingIndex >= 0) {
        // 업데이트
        index.backups[existingIndex] = backupInfo;
      } else {
        // 추가
        index.backups.push(backupInfo);
      }

      // 통계 업데이트
      index.totalBackups = index.backups.length;
      index.totalSize = index.backups.reduce((sum, b) => sum + b.fileSize, 0);
      index.lastUpdated = new Date();

      // 저장
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('인덱스 업데이트 실패:', error);
    }
  }

  /**
   * 인덱스에서 백업 제거
   */
  private async removeFromIndex(backupId: string): Promise<void> {
    try {
      const index = await this.loadIndex();

      // 백업 제거
      index.backups = index.backups.filter((b) => b.backupId !== backupId);

      // 통계 업데이트
      index.totalBackups = index.backups.length;
      index.totalSize = index.backups.reduce((sum, b) => sum + b.fileSize, 0);
      index.lastUpdated = new Date();

      // 저장
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      console.error('인덱스에서 제거 실패:', error);
    }
  }

  /**
   * ID로 백업 찾기
   */
  private async findBackupById(backupId: string): Promise<BackupInfo | null> {
    try {
      const index = await this.loadIndex();
      const backup = index.backups.find((b) => b.backupId === backupId);
      return backup || null;
    } catch (error) {
      console.error('백업 찾기 실패:', error);
      return null;
    }
  }

  /**
   * 백업 정렬
   */
  private sortBackups(
    backups: BackupInfo[],
    sortBy: 'date' | 'size' | 'filename',
    sortOrder: 'asc' | 'desc'
  ): BackupInfo[] {
    const sorted = [...backups];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.backupDate).getTime() - new Date(b.backupDate).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * 빈 디렉토리 정리
   */
  private async cleanEmptyDirectories(): Promise<void> {
    try {
      const dateFolders = await fs.readdir(this.backupDir);

      for (const folder of dateFolders) {
        if (folder === 'metadata_index.json') continue;

        const folderPath = path.join(this.backupDir, folder);
        const stat = await fs.stat(folderPath);

        if (stat.isDirectory()) {
          const files = await fs.readdir(folderPath);
          if (files.length === 0) {
            // 빈 디렉토리 삭제
            await fs.rmdir(folderPath);
          }
        }
      }
    } catch (error) {
      console.error('빈 디렉토리 정리 실패:', error);
    }
  }
}
