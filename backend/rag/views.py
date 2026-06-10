from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services.rag_engine import ask_question


@api_view(["POST"])
def ask(request):

    query = request.data.get("query")

    if not query:
        return Response(
            {"error": "Query is required"},
            status=400
        )

    answer = ask_question(query)

    return Response({
        "query": query,
        "answer": answer
    })