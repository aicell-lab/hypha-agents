declare module 'ansi-to-html' {
  interface AnsiToHtmlOptions {
    fg?: string;
    bg?: string;
    newline?: boolean;
    escapeXML?: boolean;
    stream?: boolean;
    colors?: string[] | { [key: number]: string };
  }

  class Convert {
    constructor(options?: AnsiToHtmlOptions);
    toHtml(text: string): string;
  }

  export = Convert;
} 