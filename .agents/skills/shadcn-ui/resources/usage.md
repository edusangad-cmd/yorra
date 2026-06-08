# shadcn/ui — worked example

A button + card composed with tokens and `cn()`:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Example() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-primary">Title</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Body text.</p>
        <Button variant="default">Primary action</Button>
        <Button variant="outline">Secondary</Button>
      </CardContent>
    </Card>
  );
}
```

Notes:
- `variant`/`size` come from CVA in `button.tsx`; extend variants there rather than adding ad-hoc
  classNames at call sites.
- `text-primary`, `text-muted-foreground`, `bg-primary` all resolve to the tokens in
  `src/index.css` — change a token there and every component follows.
