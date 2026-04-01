using inpsShiftPlanner as my from '../db/data_model';
////{uni as db }
service CatalogService @(path: '/odata/V4/catalog') {
  entity staffs as projection on my.staffs;
  entity appointments as projection on my.appointments;
}