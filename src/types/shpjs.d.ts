declare module "shpjs" {
  export default function shp(input: string | ArrayBuffer | any): Promise<any>;
  export function parseZip(buffer: ArrayBuffer): Promise<any>;
}
