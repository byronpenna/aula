import { adminApiClient } from "./adminApiClient";

export type NewsStatus = "draft" | "published";

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  status: NewsStatus;
  published_at: string | null;
  author_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface NewsPostInput {
  title: string;
  excerpt?: string;
  body: string;
  cover_image_url?: string;
  status: NewsStatus;
}

export async function listNews(): Promise<NewsPost[]> {
  const { data } = await adminApiClient.get<NewsPost[]>("/public-site/news");
  return data;
}

export async function createNews(payload: NewsPostInput): Promise<NewsPost> {
  const { data } = await adminApiClient.post<NewsPost>("/public-site/news", payload);
  return data;
}

export async function updateNews(id: string, payload: Partial<NewsPostInput>): Promise<NewsPost> {
  const { data } = await adminApiClient.put<NewsPost>(`/public-site/news/${id}`, payload);
  return data;
}

export async function deleteNews(id: string): Promise<void> {
  await adminApiClient.delete(`/public-site/news/${id}`);
}
