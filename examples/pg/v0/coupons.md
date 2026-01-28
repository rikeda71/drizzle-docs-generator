# coupons

## coupons

Discount coupons

### Columns

| Name             | Type        | Default             | Nullable | Children                        | Parents | Comment                          |
| ---------------- | ----------- | ------------------- | -------- | ------------------------------- | ------- | -------------------------------- |
| **id**           | uuid        | `gen_random_uuid()` | NO       | [orders.coupon_id](./orders.md) | -       | Auto-generated unique identifier |
| code             | varchar(50) | -                   | NO       | -                               | -       | Coupon code                      |
| discount_percent | integer     | -                   | NO       | -                               | -       | Discount percentage              |

### Relations

| Parent                         | Child                           | Type        |
| ------------------------------ | ------------------------------- | ----------- |
| **[coupons.id](./coupons.md)** | [orders.coupon_id](./orders.md) | Many to One |
