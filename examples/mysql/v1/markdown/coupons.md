# coupons

## coupons

Discount coupons

### Columns

| Name | Type | Default | Nullable | Children | Parents | Comment |
|------|------|---------|----------|----------|---------|---------|
| **id** | serial | - | NO | [orders.coupon_id](./orders.md) | - | Auto-generated unique identifier |
| code | varchar(50) | - | NO | - | - | Coupon code |
| discount_percent | int | - | NO | - | - | Discount percentage |

### Relations

| Parent | Child | Type |
|--------|-------|------|
| **[coupons.id](./coupons.md)** | [orders.coupon_id](./orders.md) | Many to One |
