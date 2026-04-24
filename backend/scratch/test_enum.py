
import enum

class CategoryType(str, enum.Enum):
    INCOME = "INCOME"

print(f"Value: {CategoryType.INCOME}")
print(f"Str: {str(CategoryType.INCOME)}")
print(f"Repr: {repr(CategoryType.INCOME)}")
