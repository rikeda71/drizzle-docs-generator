/**
 * Simple DBML string builder
 */
export class DbmlBuilder {
  private lines: string[] = [];
  private indentLevel = 0;

  /**
   * Increase the indentation level by one
   * @returns This instance for method chaining
   */
  indent(): this {
    this.indentLevel++;
    return this;
  }

  /**
   * Decrease the indentation level by one (minimum 0)
   * @returns This instance for method chaining
   */
  dedent(): this {
    this.indentLevel = Math.max(0, this.indentLevel - 1);
    return this;
  }

  /**
   * Add a line with the current indentation level
   * @param content - The content to add (empty string adds a blank line)
   * @returns This instance for method chaining
   */
  line(content: string = ""): this {
    const indent = "  ".repeat(this.indentLevel);
    this.lines.push(content ? `${indent}${content}` : "");
    return this;
  }

  /**
   * Build the final DBML string from all added lines
   * @returns The complete DBML content as a string
   */
  build(): string {
    return this.lines.join("\n");
  }
}
