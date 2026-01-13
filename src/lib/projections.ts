import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
proj4.defs('EPSG:3857', '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs');
proj4.defs('EPSG:4269', '+proj=longlat +datum=NAD83 +no_defs +type=crs');
proj4.defs(
  'EPSG:2154',
  '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs +type=crs',
);

register(proj4);
