# Tables

| Name | Columns | Comment |
|------|---------|---------|
| [comments](./comments.md) | 5 | Comments on posts |
| [post_tags](./post_tags.md) | 2 | Join table for many-to-many relationship between posts and tags |
| [posts](./posts.md) | 6 | Blog posts created by users |
| [tags](./tags.md) | 3 | Tags for categorizing posts |
| [users](./users.md) | 5 | User accounts table storing basic user information |

---

## ER Diagram

```mermaid
erDiagram
    comments }o--|| posts : "post_id"
    comments }o--|| users : "author_id"
    post_tags }o--|| posts : "post_id"
    post_tags }o--|| tags : "tag_id"
    posts }o--|| users : "author_id"

    comments {
        serial id PK "Auto-generated unique identifier"
        text body "Comment text"
        int post_id FK "ID of the post this comment belongs to"
        int author_id FK "ID of the user who wrote the comment"
        timestamp created_at "Timestamp when the comment was created"
    }
    post_tags {
        int post_id FK "ID of the post"
        int tag_id FK "ID of the tag"
    }
    posts {
        serial id PK "Auto-generated unique identifier"
        varchar title "Post title"
        text content "Post content body"
        boolean published "Whether the post is published"
        int author_id FK "ID of the post author"
        timestamp created_at "Timestamp when the post was created"
    }
    tags {
        serial id PK "Auto-generated unique identifier"
        varchar name UK "Tag name (must be unique)"
        varchar color "Tag color for display"
    }
    users {
        serial id PK "Auto-generated unique identifier"
        varchar name "User's display name"
        varchar email UK "Email address (must be unique)"
        boolean active "Whether the user account is active"
        timestamp created_at "Timestamp when the user was created"
    }
```
