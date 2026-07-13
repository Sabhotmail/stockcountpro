declare module "pagedjs" {
  export class Previewer {
    preview(
      content?: string | HTMLElement,
      stylesheets?: string[],
      renderTo?: string | HTMLElement,
    ): Promise<{ total: number }>;
  }
}
