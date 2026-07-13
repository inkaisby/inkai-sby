import { SITE_BRANCH_NAME, SITE_PROVINCE_NAME } from "@/lib/site";

export const surabayaBranchWhere = {
  isDeleted: false,
  name: { equals: SITE_BRANCH_NAME, mode: "insensitive" as const },
  province: {
    isDeleted: false,
    name: { equals: SITE_PROVINCE_NAME, mode: "insensitive" as const },
  },
};

export const surabayaDojoWhere = {
  isDeleted: false,
  branch: surabayaBranchWhere,
};
