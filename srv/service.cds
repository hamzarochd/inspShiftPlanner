using my from '../db/data_model';

service CatalogService {
    entity Products as projection on my.Products;
}