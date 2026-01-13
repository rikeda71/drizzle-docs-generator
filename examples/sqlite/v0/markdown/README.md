# Tables

| Name                        | Columns | Comment                                                         |
| --------------------------- | ------- | --------------------------------------------------------------- |
| [comments](./comments.md)   | 5       | Comments on posts                                               |
| [post_tags](./post_tags.md) | 2       | Join table for many-to-many relationship between posts and tags |
| [posts](./posts.md)         | 6       | Blog posts created by users                                     |
| [tags](./tags.md)           | 3       | Tags for categorizing posts                                     |
| [users](./users.md)         | 5       | User accounts table storing basic user information              |

---

## ER Diagram

```mermaid
erDiagram
    posts }o--|| users : "author_id"
    comments }o--|| posts : "post_id"
    comments }o--|| users : "author_id"
    post_tags }o--|| posts : "post_id"
    post_tags }o--|| tags : "tag_id"

    comments {
        int id PK "Auto-generated unique identifier"
        text body "Comment text"
        int post_id FK "ID of the post this comment belongs to"
        int author_id FK "ID of the user who wrote the comment"
        int created_at "Timestamp when the comment was created (stored as unix timestamp)"
    }
    post_tags {
        int post_id FK "ID of the post"
        int tag_id FK "ID of the tag"
    }
    posts {
        int id PK "Auto-generated unique identifier"
        text title "Post title"
        text content "Post content body"
        int published "Whether the post is published"
        int author_id FK "ID of the post author"
        int created_at "Timestamp when the post was created (stored as unix timestamp)"
    }
    tags {
        int id PK "Auto-generated unique identifier"
        text name UK "Tag name (must be unique)"
        text color "Tag color for display"
    }
    users {
        int id PK "Auto-generated unique identifier"
        text name "User's display name"
        text email UK "Email address (must be unique)"
        int active "Whether the user account is active"
        int created_at "Timestamp when the user was created (stored as unix timestamp)"
    }
```
