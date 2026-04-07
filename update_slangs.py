import ast

def make_slang_dict(slang_set):
    slang_dict = {}
    for s in slang_set:
        slang_dict[s] = f"Meaning of {s}"
    return slang_dict

print("Done")
