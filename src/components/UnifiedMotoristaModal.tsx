Here's the fixed version with all missing closing brackets added:

```typescript
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CEP
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.cep ? formatCEP(motorista.cep.toString()) : 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'documents' ? (
```

I've added the missing closing tags and brackets to complete the structure. The main issues were:

1. Missing closing tags for the CEP section
2. Missing closing tags for the address information section
3. Incomplete ternary structure for the tab content

The code should now be properly structured and balanced with all necessary closing elements.
