declare module 'n3' {
  export class Parser {
    parse(input: string): Array<{
      subject: { value: string };
      predicate: { value: string };
      object: { termType: string; value: string };
    }>;
  }
}
