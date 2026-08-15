import tutorials from "../../guide/member-tutorials.json";

export type MemberTutorialSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  youtubeUrl?: string;
};

export type MemberTutorialsJson = {
  version: string;
  title: string;
  subtitle?: string;
  sections: MemberTutorialSection[];
};

export const MEMBER_TUTORIALS = tutorials as MemberTutorialsJson;

export { youtubeEmbedSrc } from "@/lib/youtube";

export function getMemberTutorials(): MemberTutorialsJson {
  return MEMBER_TUTORIALS;
}
