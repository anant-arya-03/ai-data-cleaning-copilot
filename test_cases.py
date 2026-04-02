import pandas as pd
import requests

API_URL = "http://localhost:8000"

def run_tests():
    print("Testing 100% null csv...")
    df_null = pd.DataFrame({'A': [None, None], 'B': [None, None]})
    df_null.to_csv("nulls.csv", index=False)
    # Testing will be verified by running the tests manually

    print("Done generating test files.")
run_tests()
