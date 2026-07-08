import { VersionStatus } from "@/types/count";
import type { CountVersion } from "@/types/count";

export const initialCountVersions: CountVersion[] = [
  {
    id: "ver_bkk1_002_v1",
    documentId: "doc_bkk1_002",
    versionNo: 1,
    status: VersionStatus.DRAFT,
    createdAt: "2026-07-08T08:35:00.000Z",
    createdBy: "user_bkk1_staff",
  },
  {
    id: "ver_bkk1_003_v1",
    documentId: "doc_bkk1_003",
    versionNo: 1,
    status: VersionStatus.SUBMITTED,
    createdAt: "2026-07-08T07:05:00.000Z",
    createdBy: "user_bkk1_staff",
    submittedAt: "2026-07-08T10:00:00.000Z",
    submittedBy: "user_bkk1_staff",
  },
  {
    id: "ver_bkk1_004_v1",
    documentId: "doc_bkk1_004",
    versionNo: 1,
    status: VersionStatus.LOCKED,
    createdAt: "2026-07-08T09:05:00.000Z",
    createdBy: "user_bkk1_staff",
    submittedAt: "2026-07-08T11:00:00.000Z",
    submittedBy: "user_bkk1_staff",
  },
  {
    id: "ver_bkk1_004_v2",
    documentId: "doc_bkk1_004",
    versionNo: 2,
    status: VersionStatus.DRAFT,
    baseVersionId: "ver_bkk1_004_v1",
    createdAt: "2026-07-08T11:30:00.000Z",
    createdBy: "user_bkk1_supervisor",
  },
  {
    id: "ver_chm_001_v1",
    documentId: "doc_chm_001",
    versionNo: 1,
    status: VersionStatus.APPROVED,
    createdAt: "2026-07-08T06:05:00.000Z",
    createdBy: "user_admin",
    submittedAt: "2026-07-08T09:00:00.000Z",
    submittedBy: "user_admin",
  },
];
