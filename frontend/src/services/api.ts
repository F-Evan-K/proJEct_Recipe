export const apiMode =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    .VITE_DATA_MODE === "api";
const base =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    .VITE_API_URL ?? "http://127.0.0.1:3000/api/v1";
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(base + path, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = data.error;
    throw new Error(
      typeof error === "string"
        ? error
        : Array.isArray(error?.message)
          ? error.message.join(", ")
          : (error?.message ?? "API request failed (" + response.status + ")"),
    );
  }
  return data as T;
}
export type ApiIngredient = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  minimum: string;
};
export type ApiMenu = {
  id: number;
  name: string;
  category: string;
  price: string;
  emoji: string;
  active: boolean;
  recipe: {
    ingredientId: number;
    quantity: string;
    ingredient: ApiIngredient;
  }[];
};
export type ApiWaste = {
  quantity: string;
  reason: string;
  ingredient: ApiIngredient;
};
export const kitchenApi = {
  menus: () => apiRequest<ApiMenu[]>("/menus"),
  inventory: () => apiRequest<ApiIngredient[]>("/inventory"),
  wastes: () => apiRequest<ApiWaste[]>("/waste-records"),
  post: <T>(path: string, data: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(data) }),
};
